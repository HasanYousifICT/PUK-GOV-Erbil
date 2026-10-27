"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  AlignLeft,
  ArrowUp,
  Calendar,
  CheckSquare,
  Download,
  FileText,
  Hash,
  Layers,
  Link2,
  ListChecks,
  Loader2,
  Lock,
  Mail,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Table2,
  ToggleLeft,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";
import { toast } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog, ErrorState, TableSkeleton } from "@/components/shared";
import { SearchableSelect } from "@/components/searchable-select";
import { apiClient, ColumnInput } from "@/lib/client";
import {
  CandidateField,
  CandidateSection,
  CustomValue,
  fieldLabel,
  groupFields,
  BUILTIN_FIELDS,
  isPersonalSection,
  hasList,
  hasOptions,
  isTableValue,
  MAX_TABLE_ROWS,
  MAX_SECTIONS,
  sectionLabel,
  FieldType,
  FIELD_TYPES,
  isEmptyValue,
  isFileValue,
  MAX_FIELDS,
  ShowIf,
  ShowOp,
  ShowRule,
  ColumnDef,
  ColumnType,
  COLUMN_TYPES,
  MAX_CONDITIONS,
  MAX_TABLE_COLUMNS,
} from "@/lib/candidate-fields";
import { useI18n } from "@/lib/i18n";

/* ------------------------------ shared loading ------------------------------ */

let cache: CandidateField[] | null = null;
let inflight: Promise<CandidateField[]> | null = null;

export function useCandidateFields() {
  const [fields, setFields] = useState<CandidateField[] | null>(cache);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (cache && version === 0) return;
    let cancelled = false;
    if (!inflight || version > 0) {
      inflight = apiClient.listCandidateFields().finally(() => {
        inflight = null;
      });
    }
    inflight
      .then((rows) => {
        cache = rows;
        if (!cancelled) {
          setFields(rows);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load fields");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return {
    fields,
    error,
    reload: () => {
      cache = null;
      setVersion((v) => v + 1);
    },
  };
}

let sectionsCache: CandidateSection[] | null = null;
let sectionsInflight: Promise<CandidateSection[]> | null = null;

export function useCandidateSections() {
  const [sections, setSections] = useState<CandidateSection[] | null>(sectionsCache);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (sectionsCache && version === 0) return;
    let cancelled = false;
    if (!sectionsInflight || version > 0) {
      sectionsInflight = apiClient.listCandidateSections().finally(() => {
        sectionsInflight = null;
      });
    }
    sectionsInflight
      .then((rows) => {
        sectionsCache = rows;
        if (!cancelled) setSections(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [version]);

  return {
    sections,
    reload: () => {
      sectionsCache = null;
      setVersion((v) => v + 1);
    },
  };
}

const TYPE_ICON: Record<FieldType, typeof Type> = {
  text: Type,
  longtext: AlignLeft,
  number: Hash,
  date: Calendar,
  email: Mail,
  phone: Phone,
  url: Link2,
  yesno: ToggleLeft,
  select: ListChecks,
  multiselect: CheckSquare,
  file: Paperclip,
  table: Table2,
};

export function useTypeLabels() {
  const { t } = useI18n();
  return {
    text: t("Text (short)"),
    longtext: t("Long text (paragraph)"),
    number: t("Number"),
    date: t("Date"),
    email: t("Email address"),
    phone: t("Phone number"),
    url: t("Web link (URL)"),
    yesno: t("Yes / No"),
    select: t("Dropdown (single choice)"),
    multiselect: t("Multiple choice (several options)"),
    file: t("Attachment"),
    table: t("Table (repeating rows)"),
  } as Record<FieldType, string>;
}

/* ------------------------------ input per type ------------------------------ */

const NONE = "__none__";

export function CustomFieldInput({
  field,
  value,
  onChange,
  upload,
  showRequired = true,
}: {
  field: CandidateField;
  value: CustomValue | undefined;
  onChange: (v: CustomValue | undefined) => void;
  /** Custom uploader (the public form uses an anonymous endpoint). */
  upload?: (file: File) => Promise<{ key: string; name: string }>;
  /** Show the * on required fields (staff screens do not enforce them). */
  showRequired?: boolean;
}) {
  const { t, locale } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const id = `cf-${field.id}`;
  const label = fieldLabel(field, locale);

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const r = await (upload ?? apiClient.uploadFile)(file);
      onChange({ key: r.key, name: r.name });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {field.required && showRequired ? " *" : ""}
      </Label>

      {field.type === "text" && (
        <Input id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
      )}

      {field.type === "longtext" && (
        <Textarea id={id} rows={4} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
      )}

      {(field.type === "email" || field.type === "phone" || field.type === "url" || field.type === "date") && (
        <Input
          id={id}
          type={field.type === "phone" ? "tel" : field.type}
          dir="ltr"
          placeholder={field.type === "url" ? "https://" : undefined}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === "yesno" && (
        <Select value={typeof value === "string" && value ? value : NONE} onValueChange={(v) => onChange(v === NONE ? undefined : v)}>
          <SelectTrigger id={id} aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("— (none)")}</SelectItem>
            <SelectItem value="yes">{t("Yes")}</SelectItem>
            <SelectItem value="no">{t("No")}</SelectItem>
          </SelectContent>
        </Select>
      )}

      {field.type === "multiselect" && (
        <MultiSelectInput id={id} label={label} field={field} value={Array.isArray(value) ? value : []} onChange={onChange} />
      )}

      {field.type === "number" && (
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          dir="ltr"
          value={value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        />
      )}

      {field.type === "select" &&
        (field.options.length > 7 ? (
          <SearchableSelect
            id={id}
            ariaLabel={label}
            value={typeof value === "string" && value ? value : undefined}
            noneLabel={t("— (none)")}
            placeholder={t("Select an option")}
            options={field.options.map((o) => ({ value: o, label: o }))}
            onChange={(v) => onChange(v)}
          />
        ) : (
          <Select
            value={typeof value === "string" && value ? value : NONE}
            onValueChange={(v) => onChange(v === NONE ? undefined : v)}
          >
            <SelectTrigger id={id} aria-label={label}>
              <SelectValue placeholder={t("Select an option")} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={NONE}>{t("— (none)")}</SelectItem>
              {field.options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

      {field.type === "table" && (
        <TableInput
          field={field}
          rows={isTableValue(value) ? value.rows : []}
          onChange={(rows) => onChange(rows.length ? { rows } : undefined)}
        />
      )}

      {field.type === "file" && (
        <>
          {isFileValue(value) ? (
            <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium" dir="auto">
                {value.name}
              </p>
              <a
                href={apiClient.resumeUrl(value.key)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-accent"
              >
                <Download className="h-3.5 w-3.5" /> {t("View")}
              </a>
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="me-1.5 h-3.5 w-3.5" />}
                {t("Replace")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-600"
                aria-label={t("Remove")}
                onClick={() => onChange(undefined)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              id={id}
              type="button"
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? t("Uploading…") : t("Choose file")}
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
            aria-label={label}
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </>
      )}
    </div>
  );
}

/** Several choices; with many options a search box filters the list. */
function MultiSelectInput({
  id,
  label,
  field,
  value,
  onChange,
}: {
  id: string;
  label: string;
  field: CandidateField;
  value: string[];
  onChange: (v: CustomValue | undefined) => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const many = field.options.length > 8;
  const shown = field.options.filter((o) => !q.trim() || o.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div id={id} role="group" aria-label={label} className="space-y-2">
      {many && (
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search…")} aria-label={t("Search…")} />
      )}
      {value.length > 0 && many && (
        <p className="text-xs text-muted-foreground">{t("{n} selected", { n: value.length })}</p>
      )}
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border bg-card p-3">
        {shown.length === 0 && <p className="text-sm text-muted-foreground">{t("No results found.")}</p>}
        {shown.map((o) => {
          const cid = `${id}-${field.options.indexOf(o)}`;
          return (
            <div key={o} className="flex items-center gap-2">
              <Checkbox
                id={cid}
                checked={value.includes(o)}
                onCheckedChange={(c) => {
                  const next = c === true ? [...value, o] : value.filter((x) => x !== o);
                  onChange(next.length ? next : undefined);
                }}
              />
              <Label htmlFor={cid} className="font-normal">
                {o}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One table cell, shaped by its column's type. */
function CellInput({ def, value, onChange, label }: { def: ColumnDef; value: string; onChange: (v: string) => void; label: string }) {
  const { t } = useI18n();
  if (def.type === "yesno" || def.type === "select") {
    const choices = def.type === "yesno" ? ["yes", "no"] : def.options;
    return (
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={NONE}>{t("— (none)")}</SelectItem>
          {choices.map((o) => (
            <SelectItem key={o} value={o}>
              {o === "yes" ? t("Yes") : o === "no" ? t("No") : o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  const type = def.type === "number" ? "number" : def.type === "date" ? "date" : def.type === "email" ? "email" : def.type === "phone" ? "tel" : "text";
  return (
    <Input
      type={type}
      dir={type === "text" ? undefined : "ltr"}
      inputMode={def.type === "number" ? "decimal" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={300}
      aria-label={label}
    />
  );
}

/** Repeating rows: one small card per row, one input per column. */
function TableInput({
  field,
  rows,
  onChange,
}: {
  field: CandidateField;
  rows: string[][];
  onChange: (rows: string[][]) => void;
}) {
  const { t } = useI18n();
  const cols = field.options.length;
  const defOf = (j: number): ColumnDef => field.columns[j] ?? { type: "text", required: false, options: [] };
  const blank = () => Array.from({ length: cols }, () => "");
  const setCell = (r: number, c: number, v: string) =>
    onChange(rows.map((row, i) => (i === r ? Array.from({ length: cols }, (_, j) => (j === c ? v : row[j] ?? "")) : row)));
  return (
    <div className="space-y-2">
      {rows.map((row, r) => (
        <div key={r} className="flex items-start gap-2 rounded-lg border bg-card p-3">
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
            {field.options.map((c, j) => (
              <div key={c} className="space-y-1">
                <Label className="text-xs font-normal text-muted-foreground">
                  {c}
                  {defOf(j).required ? " *" : ""}
                </Label>
                <CellInput def={defOf(j)} value={row[j] ?? ""} onChange={(v) => setCell(r, j, v)} label={`${c} (${r + 1})`} />
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-red-600 hover:text-red-600"
            aria-label={t("Remove")}
            onClick={() => onChange(rows.filter((_, i) => i !== r))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={rows.length >= MAX_TABLE_ROWS}
        onClick={() => onChange([...rows, blank()])}
      >
        <Plus className="me-1.5 h-3.5 w-3.5" /> {t("Add row")}
      </Button>
    </div>
  );
}

/** Read-only rendering for the candidate profile. */
export function CustomFieldValue({ field, value }: { field: CandidateField; value: CustomValue | undefined }) {
  const { t } = useI18n();
  if (isEmptyValue(value)) return <span className="text-muted-foreground">—</span>;
  if (isTableValue(value)) {
    return (
      <div className="max-w-full overflow-x-auto rounded-md border">
        <table className="w-full text-start text-xs">
          <thead className="bg-muted/50">
            <tr>
              {field.options.map((c) => (
                <th key={c} className="px-2 py-1.5 text-start font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {value.rows.map((r, i) => (
              <tr key={i} className="border-t">
                {field.options.map((c, j) => (
                  <td key={c} className="px-2 py-1.5 align-top" dir="auto">
                    {r[j] === "yes" ? t("Yes") : r[j] === "no" ? t("No") : r[j] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (isFileValue(value)) {
    return (
      <span className="inline-flex max-w-full items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate" dir="auto">
          {value.name}
        </span>
        <a
          href={apiClient.resumeUrl(value.key)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" /> {t("View")}
        </a>
      </span>
    );
  }
  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap gap-1">
        {value.map((x) => (
          <Badge key={x} variant="secondary" className="font-normal">
            {x}
          </Badge>
        ))}
      </span>
    );
  }
  const text = String(value);
  const linkClass = "text-primary underline-offset-2 hover:underline break-all";
  if (field.type === "yesno") return <span>{text === "yes" ? t("Yes") : t("No")}</span>;
  if (field.type === "email")
    return (
      <a href={`mailto:${text}`} dir="ltr" className={linkClass}>
        {text}
      </a>
    );
  if (field.type === "phone")
    return (
      <a href={`tel:${text.replace(/[^+\d]/g, "")}`} dir="ltr" className={linkClass}>
        {text}
      </a>
    );
  if (field.type === "url" && /^https?:\/\//i.test(text))
    return (
      <a href={text} target="_blank" rel="noopener noreferrer" dir="ltr" className={linkClass}>
        {text}
      </a>
    );
  return (
    <span dir={field.type === "number" || field.type === "date" ? "ltr" : "auto"} className="break-words whitespace-pre-wrap">
      {text}
    </span>
  );
}

/* ------------------------- Settings: manage the fields ------------------------ */

type Editing = { mode: "add" } | { mode: "edit"; field: CandidateField };

const NEW_SECTION = "__new__";

function FieldFormDialog({
  editing,
  sections,
  allFields,
  onClose,
  onSaved,
}: {
  editing: Editing | null;
  sections: CandidateSection[];
  allFields: CandidateField[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useI18n();
  const [sectionId, setSectionId] = useState("");
  const [newSection, setNewSection] = useState("");
  const [newSectionCkb, setNewSectionCkb] = useState("");
  const typeLabels = useTypeLabels();
  const [label, setLabel] = useState("");
  const [labelCkb, setLabelCkb] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [required, setRequired] = useState(false);
  const [publicForm, setPublicForm] = useState(true);
  const [optionsText, setOptionsText] = useState("");
  const [conds, setConds] = useState<ShowIf[]>([]);
  const [match, setMatch] = useState<"all" | "any">("all");
  const [cols, setCols] = useState<ColDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setError(null);
    setNewSection("");
    setNewSectionCkb("");
    if (editing.mode === "edit") {
      setLabel(editing.field.label);
      setLabelCkb(editing.field.labelCkb);
      setType(editing.field.type);
      setRequired(editing.field.required);
      setPublicForm(editing.field.publicForm);
      setSectionId(sections.some((x) => x.id === editing.field.sectionId) ? editing.field.sectionId : sections[0]?.id ?? "");
      setOptionsText(editing.field.options.join("\n"));
      setConds(editing.field.showIf?.conds ?? []);
      setMatch(editing.field.showIf?.match ?? "all");
      setCols(
        editing.field.type === "table"
          ? editing.field.options.map((name, i) => {
              const d = editing.field.columns[i];
              return { name, type: d?.type ?? "text", required: d?.required ?? false, optionsText: (d?.options ?? []).join("\n") };
            })
          : []
      );
    } else {
      setLabel("");
      setLabelCkb("");
      setType("text");
      setRequired(false);
      setPublicForm(true);
      setSectionId(sections[0]?.id ?? "");
      setOptionsText("");
      setConds([]);
      setMatch("all");
      setCols([{ name: "", type: "text", required: false, optionsText: "" }]);
    }
  }, [editing]);

  const selfId = editing?.mode === "edit" ? editing.field.id : null;
  const condParents = allFields.filter((f) => f.id !== selfId && f.type !== "file" && f.type !== "table");
  const showIf: ShowRule | null = conds.length ? { match, conds } : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!label.trim()) {
      setError("Field name is required");
      return;
    }
    const options = optionsText.split("\n").map((o) => o.trim()).filter(Boolean);
    const columns: ColumnInput[] = cols
      .filter((c) => c.name.trim() || c.optionsText.trim())
      .map((c) => ({
        name: c.name.trim(),
        type: c.type,
        required: c.required,
        options: c.optionsText.split("\n").map((o) => o.trim()).filter(Boolean),
      }));
    if (type === "table") {
      if (columns.length === 0 || columns.length > MAX_TABLE_COLUMNS) {
        setError(columns.length === 0 ? "Add at least one column" : "Too many columns (max 8)");
        return;
      }
      if (columns.some((c) => !c.name)) return setError("Every column needs a name");
      if (new Set(columns.map((c) => c.name.toLowerCase())).size !== columns.length) return setError("Two columns have the same name");
      const bad = columns.find((c) => c.type === "select" && c.options.length === 0);
      if (bad) return setError(t("Add the choices for the “{name}” column", { name: bad.name }));
    }
    if (hasOptions(type) && options.length === 0) {
      setError("Add at least one option");
      return;
    }
    if (conds.some((c) => !c.fieldId)) {
      setError("Choose a field for every condition");
      return;
    }
    if (conds.some((c) => c.op !== "filled" && !c.value)) {
      setError("Choose the value that shows this field");
      return;
    }
    if (sectionId === NEW_SECTION && !newSection.trim()) {
      setError("Section name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let sid = sectionId;
      if (sid === NEW_SECTION) {
        const created = await apiClient.createCandidateSection({ name: newSection, nameCkb: newSectionCkb });
        sid = created.id;
      }
      if (editing.mode === "edit") {
        await apiClient.updateCandidateField(editing.field.id, {
          label,
          labelCkb,
          required,
          publicForm,
          sectionId: sid,
          showIf,
          ...(type === "table" ? { columns } : hasList(type) ? { options } : {}),
        });
        toast.success("Field updated");
      } else {
        await apiClient.createCandidateField({
          label,
          labelCkb,
          type,
          required,
          publicForm,
          sectionId: sid,
          showIf,
          ...(type === "table" ? { columns } : hasList(type) ? { options } : {}),
        });
        toast.success("Field added");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing?.mode === "edit" ? t("Edit field") : t("Add field")}</DialogTitle>
          <DialogDescription>
            {t("This field appears on every candidate profile and can be used to filter candidates.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="field-label">{t("Field name *")}</Label>
            <Input id="field-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("e.g. Driving licence")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="field-label-ckb">{t("Field name (Kurdish Sorani)")}</Label>
            <Input id="field-label-ckb" value={labelCkb} onChange={(e) => setLabelCkb(e.target.value)} dir="rtl" lang="ckb" />
          </div>
          <div className="space-y-2">
            <Label>{t("Field type")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as FieldType)} disabled={editing?.mode === "edit"}>
              <SelectTrigger aria-label={t("Field type")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((ft) => (
                  <SelectItem key={ft} value={ft}>
                    {typeLabels[ft]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editing?.mode === "edit" && (
              <p className="text-xs text-muted-foreground">{t("The type cannot be changed after the field is created.")}</p>
            )}
          </div>
          {type === "table" && <ColumnsEditor cols={cols} onChange={setCols} />}
          {hasList(type) && type !== "table" && (
            <div className="space-y-2">
              <Label htmlFor="field-options">{t("Options (one per line)")}</Label>
              <Textarea
                id="field-options"
                rows={6}
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder={"Option A\nOption B\nOption C"}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>{t("Section")}</Label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger aria-label={t("Section")}>
                <SelectValue placeholder={t("Select a section")} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {sections.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {sectionLabel(x, locale)}
                  </SelectItem>
                ))}
                {sections.length < MAX_SECTIONS && <SelectItem value={NEW_SECTION}>{t("+ Add new section…")}</SelectItem>}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("The field is shown in this section of the candidate profile and form.")}</p>
            {sectionId === NEW_SECTION && (
              <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-section" className="text-xs">{t("Section name *")}</Label>
                  <Input id="new-section" value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder={t("e.g. Languages")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-section-ckb" className="text-xs">{t("Section name (Kurdish Sorani)")}</Label>
                  <Input id="new-section-ckb" dir="rtl" lang="ckb" value={newSectionCkb} onChange={(e) => setNewSectionCkb(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <ConditionsEditor conds={conds} match={match} onChange={setConds} onMatch={setMatch} parents={condParents} />
          <div className="flex items-center gap-2">
            <Checkbox id="field-required" checked={required} onCheckedChange={(c) => setRequired(c === true)} />
            <Label htmlFor="field-required" className="font-normal">
              {t("Required on the application form")}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="field-public" checked={publicForm} onCheckedChange={(c) => setPublicForm(c === true)} />
            <Label htmlFor="field-public" className="font-normal">
              {t("Show on the public application form")}
            </Label>
          </div>
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(error)}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------- table columns (type + required) ---------------------- */

type ColDraft = { name: string; type: ColumnType; required: boolean; optionsText: string };

function ColumnsEditor({ cols, onChange }: { cols: ColDraft[]; onChange: (c: ColDraft[]) => void }) {
  const { t } = useI18n();
  const typeNames: Record<ColumnType, string> = {
    text: t("Text"),
    number: t("Number"),
    date: t("Date"),
    email: t("Email"),
    phone: t("Phone"),
    yesno: t("Yes / No"),
    select: t("Dropdown (single choice)"),
  };
  const set = (i: number, patch: Partial<ColDraft>) => onChange(cols.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-2">
      <Label>{t("Columns (max 8)")}</Label>
      <div className="space-y-2">
        {cols.map((c, i) => (
          <div key={i} className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <Input
                value={c.name}
                onChange={(e) => set(i, { name: e.target.value })}
                placeholder={t("Column name")}
                aria-label={t("Column name")}
                maxLength={100}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-red-600 hover:text-red-600"
                aria-label={t("Remove")}
                disabled={cols.length <= 1}
                onClick={() => onChange(cols.filter((_, k) => k !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-44 flex-1">
                <Select value={c.type} onValueChange={(v) => set(i, { type: v as ColumnType })}>
                  <SelectTrigger aria-label={t("Column type")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMN_TYPES.map((ct) => (
                      <SelectItem key={ct} value={ct}>
                        {typeNames[ct]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id={`col-req-${i}`} checked={c.required} onCheckedChange={(v) => set(i, { required: v === true })} />
                <Label htmlFor={`col-req-${i}`} className="font-normal">
                  {t("Required")}
                </Label>
              </div>
            </div>
            {c.type === "select" && (
              <Textarea
                rows={3}
                value={c.optionsText}
                onChange={(e) => set(i, { optionsText: e.target.value })}
                placeholder={t("Choices (one per line)")}
                aria-label={t("Choices (one per line)")}
              />
            )}
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={cols.length >= MAX_TABLE_COLUMNS}
        onClick={() => onChange([...cols, { name: "", type: "text", required: false, optionsText: "" }])}
      >
        <Plus className="me-1.5 h-3.5 w-3.5" /> {t("Add column")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("A required column must be filled in every row that is added.")}</p>
    </div>
  );
}

/* ------------------------ "show only if…" (many conditions) ------------------------ */

function ConditionsEditor({
  conds,
  match,
  parents,
  onChange,
  onMatch,
}: {
  conds: ShowIf[];
  match: "all" | "any";
  parents: CandidateField[];
  onChange: (c: ShowIf[]) => void;
  onMatch: (m: "all" | "any") => void;
}) {
  const { t, locale } = useI18n();
  const set = (i: number, patch: Partial<ShowIf>) => onChange(conds.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <Label>{t("Show this field only if…")}</Label>
      {conds.length === 0 && <p className="text-sm text-muted-foreground">{t("Always show")}</p>}
      {conds.length > 1 && (
        <Select value={match} onValueChange={(v) => onMatch(v as "all" | "any")}>
          <SelectTrigger aria-label={t("How the conditions combine")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All of these conditions are met")}</SelectItem>
            <SelectItem value="any">{t("Any one of these conditions is met")}</SelectItem>
          </SelectContent>
        </Select>
      )}
      {conds.map((c, i) => {
        const parent = parents.find((f) => f.id === c.fieldId);
        const choices = parent?.type === "yesno" ? ["yes", "no"] : parent && hasOptions(parent.type) ? parent.options : null;
        return (
          <div key={i} className="space-y-2 rounded-md border bg-background p-2">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  value={c.fieldId || NONE}
                  onValueChange={(v) => {
                    const p = parents.find((f) => f.id === v);
                    set(i, { fieldId: v === NONE ? "" : v, value: "", op: p && !(p.type === "yesno" || hasOptions(p.type)) ? "filled" : "equals" });
                  }}
                >
                  <SelectTrigger aria-label={t("Show this field only if…")}>
                    <SelectValue placeholder={t("Select a field")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {parents.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {fieldLabel(f, locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-red-600 hover:text-red-600"
                aria-label={t("Remove")}
                onClick={() => onChange(conds.filter((_, k) => k !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {parent && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Select value={c.op} onValueChange={(v) => set(i, { op: v as ShowOp })}>
                  <SelectTrigger aria-label={t("Condition")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {choices && <SelectItem value="equals">{t("is")}</SelectItem>}
                    {choices && <SelectItem value="notEquals">{t("is not")}</SelectItem>}
                    <SelectItem value="filled">{t("has an answer")}</SelectItem>
                  </SelectContent>
                </Select>
                {c.op !== "filled" && choices && (
                  <SearchableSelect
                    value={c.value}
                    onChange={(v) => set(i, { value: v ?? "" })}
                    ariaLabel={t("Select a value")}
                    options={choices.map((o) => ({ value: o, label: o === "yes" ? t("Yes") : o === "no" ? t("No") : o }))}
                    placeholder={t("Select a value")}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={conds.length >= MAX_CONDITIONS || parents.length === 0}
        onClick={() => onChange([...conds, { fieldId: "", op: "equals", value: "" }])}
      >
        <Plus className="me-1.5 h-3.5 w-3.5" /> {t("Add condition")}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t("The field appears on the forms only when this condition is met. Hidden answers are not saved.")}
      </p>
    </div>
  );
}

const BUILTIN_ICON = { user: Type, mail: Mail, phone: Phone, text: Type } as const;

function BuiltInRows() {
  const { t } = useI18n();
  return (
    <>
      {BUILTIN_FIELDS.map((b) => {
        const Icon = BUILTIN_ICON[b.icon];
        return (
          <li key={b.key} className="flex items-center gap-3 bg-muted/30 px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t(b.label)}</p>
              <p className="truncate text-xs text-muted-foreground">{t("Built-in field")}</p>
            </div>
            <Badge variant="outline" className="gap-1 font-normal">
              <Lock className="h-3 w-3" />
              {t("Cannot be deleted")}
            </Badge>
          </li>
        );
      })}
    </>
  );
}

export function CandidateFieldsSettings() {
  const { t, locale } = useI18n();
  const typeLabels = useTypeLabels();
  const { fields, error, reload } = useCandidateFields();
  const { sections, reload: reloadSections } = useCandidateSections();
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<CandidateField | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetBusy, setPresetBusy] = useState(false);

  async function importPreset() {
    setPresetBusy(true);
    try {
      const r = await apiClient.importBoardPreset();
      toast.success(t("Imported {n} fields ({s} new sections)", { n: r.fields, s: r.sections }));
      if (r.removedSections > 0) toast.success(t("Removed {n} empty starter sections", { n: r.removedSections }));
      setPresetOpen(false);
      reload();
      reloadSections();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setPresetBusy(false);
    }
  }
  const [moving, setMoving] = useState(false);

  const atLimit = useMemo(() => (fields?.length ?? 0) >= MAX_FIELDS, [fields]);

  async function move(group: CandidateField[], index: number, delta: -1 | 1) {
    if (!fields) return;
    const other = group[index + delta];
    if (!other) return;
    const ids = fields.map((f) => f.id);
    const a = ids.indexOf(group[index].id);
    const b = ids.indexOf(other.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    setMoving(true);
    try {
      await apiClient.reorderCandidateFields(ids);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reorder fields");
    } finally {
      setMoving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiClient.deleteCandidateField(deleting.id);
      toast.success("Field deleted");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete field");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t("Candidate profile fields")}</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("Add your own fields to the candidate profile: text, paragraph, number, date, email, phone, link, yes/no, dropdown, multiple choice or attachment. They appear in the candidate form and can be used as filters.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPresetOpen(true)} disabled={!sections}>
            <Download className="me-2 h-4 w-4" />
            {t("Import board form fields")}
          </Button>
          <Button variant="outline" onClick={() => setSectionsOpen(true)} disabled={!sections}>
            <Layers className="me-2 h-4 w-4" />
            {t("Manage sections")}
          </Button>
          <Button onClick={() => setEditing({ mode: "add" })} disabled={atLimit || !sections}>
            <Plus className="me-2 h-4 w-4" />
            {t("Add field")}
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {error && <ErrorState message={error} onRetry={reload} />}
        {!fields && !error && <TableSkeleton rows={3} />}
        {fields && fields.length === 0 && (
          <p className="mb-4 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            {t("No custom fields yet. Click “Add field” to create the first one.")}
          </p>
        )}
        {fields && sections && (
          <div className="space-y-4">
            {!sections.some(isPersonalSection) && (
              <div>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" />
                  {t("Personal information")}
                </h3>
                <ul className="divide-y rounded-lg border">
                  <BuiltInRows />
                </ul>
              </div>
            )}
            {groupFields(fields, sections, true).map(({ section, fields: group }) => (
              <div key={section.id}>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" />
                  {sectionLabel(section, locale)}
                  <span className="font-normal normal-case">({group.length})</span>
                </h3>
                {group.length === 0 && !isPersonalSection(section) && (
                  <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                    {t("No fields in this section yet.")}
                  </p>
                )}
                {(group.length > 0 || isPersonalSection(section)) && <ul className="divide-y rounded-lg border">
                  {isPersonalSection(section) && <BuiltInRows />}
                  {group.map((f, i) => {
                    const Icon = TYPE_ICON[f.type];
                    return (
                      <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{fieldLabel(f, locale)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {typeLabels[f.type]}
                            {hasOptions(f.type) ? ` · ${t("{n} options", { n: f.options.length })}` : ""}
                            {f.type === "table" ? ` · ${t("{n} columns", { n: f.options.length })}` : ""}
                            {f.showIf ? ` · ${t("Conditional")}` : ""}
                          </p>
                        </div>
                        {!f.publicForm && (
                          <Badge variant="outline" className="font-normal">
                            {t("Internal")}
                          </Badge>
                        )}
                        {f.required && (
                          <Badge variant="secondary" className="font-normal">
                            {t("Required")}
                          </Badge>
                        )}
                        <div className="flex items-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("Move up")} disabled={i === 0 || moving} onClick={() => move(group, i, -1)}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("Move down")} disabled={i === group.length - 1 || moving} onClick={() => move(group, i, 1)}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("Actions for {name}", { name: f.label })}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditing({ mode: "edit", field: f })}>
                                <Pencil className="me-2 h-4 w-4" /> {t("Edit")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleting(f)}>
                                <Trash2 className="me-2 h-4 w-4" /> {t("Delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </li>
                    );
                  })}
                </ul>}
              </div>
            ))}
          </div>
        )}
      </div>

      <FieldFormDialog
        editing={editing}
        sections={sections ?? []}
        allFields={fields ?? []}
        onClose={() => setEditing(null)}
        onSaved={() => {
          reload();
          reloadSections();
        }}
      />
      <SectionsDialog
        open={sectionsOpen}
        onOpenChange={setSectionsOpen}
        sections={sections ?? []}
        onChanged={() => {
          reloadSections();
          reload();
        }}
      />
      <ConfirmDialog
        open={presetOpen}
        onOpenChange={setPresetOpen}
        title={t("Import the board form fields?")}
        description={t("Adds the sections and fields of your Jotform (personal details, documents, family, education, languages, government and party information, …). Existing fields are kept and nothing is duplicated.")}
        confirmLabel="Import"
        destructive={false}
        onConfirm={importPreset}
        busy={presetBusy}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("Delete field “{name}”?", { name: deleting?.label ?? "" })}
        description={t("The values (and attachments) saved in this field for every candidate will be permanently deleted.")}
        onConfirm={handleDelete}
        busy={deleteBusy}
      />
    </div>
  );
}

/* ------------------------------ sections manager ------------------------------ */

function SectionsDialog({
  open,
  onOpenChange,
  sections,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sections: CandidateSection[];
  onChanged: () => void;
}) {
  const { t, locale } = useI18n();
  const [name, setName] = useState("");
  const [nameCkb, setNameCkb] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCkb, setEditCkb] = useState("");
  const [deleting, setDeleting] = useState<CandidateSection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setEditId(null);
      setName("");
      setNameCkb("");
    }
  }, [open]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Section name is required");
    await run(async () => {
      await apiClient.createCandidateSection({ name, nameCkb });
      setName("");
      setNameCkb("");
    });
  }

  function move(i: number, delta: -1 | 1) {
    const ids = sections.map((x) => x.id);
    [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
    return run(() => apiClient.reorderCandidateSections(ids));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Profile sections")}</DialogTitle>
          <DialogDescription>
            {t("Sections group your fields on the candidate profile and form. Add, rename, reorder or delete them.")}
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y rounded-lg border">
          {sections.map((sec, i) => (
            <li key={sec.id} className="flex items-center gap-2 px-3 py-2">
              {editId === sec.id ? (
                <>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} aria-label={t("Section name *")} />
                    <Input dir="rtl" lang="ckb" value={editCkb} onChange={(e) => setEditCkb(e.target.value)} aria-label={t("Section name (Kurdish Sorani)")} />
                  </div>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await apiClient.updateCandidateSection(sec.id, { name: editName, nameCkb: editCkb });
                        setEditId(null);
                      })
                    }
                  >
                    {t("Save")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                    {t("Cancel")}
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{sectionLabel(sec, locale)}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("Move up")} disabled={i === 0 || busy} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("Move down")} disabled={i === sections.length - 1 || busy} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={t("Edit")}
                    onClick={() => {
                      setEditId(sec.id);
                      setEditName(sec.name);
                      setEditCkb(sec.nameCkb);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-600"
                    aria-label={t("Delete")}
                    disabled={sections.length <= 1}
                    onClick={() => setDeleting(sec)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={add} className="space-y-2 rounded-lg border bg-muted/30 p-3" noValidate>
          <p className="text-sm font-medium">{t("Add new section")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Languages")} aria-label={t("Section name *")} />
            <Input dir="rtl" lang="ckb" value={nameCkb} onChange={(e) => setNameCkb(e.target.value)} placeholder={t("Section name (Kurdish Sorani)")} aria-label={t("Section name (Kurdish Sorani)")} />
          </div>
          <Button type="submit" size="sm" disabled={busy || sections.length >= MAX_SECTIONS}>
            <Plus className="me-1.5 h-3.5 w-3.5" />
            {t("Add new section")}
          </Button>
        </form>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {t(error)}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Close")}
          </Button>
        </DialogFooter>

        <ConfirmDialog
          open={!!deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
          title={t("Delete section “{name}”?", { name: deleting?.name ?? "" })}
          description={t("Its fields are not deleted; they move to the first remaining section.")}
          onConfirm={async () => {
            if (!deleting) return;
            const id = deleting.id;
            setDeleting(null);
            await run(() => apiClient.deleteCandidateSection(id));
          }}
          busy={busy}
        />
      </DialogContent>
    </Dialog>
  );
}
