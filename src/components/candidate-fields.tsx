"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileText,
  Hash,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
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
import { apiClient } from "@/lib/client";
import {
  CandidateField,
  CustomValue,
  fieldLabel,
  FieldType,
  FIELD_TYPES,
  isEmptyValue,
  isFileValue,
  MAX_FIELDS,
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

const TYPE_ICON: Record<FieldType, typeof Type> = {
  text: Type,
  number: Hash,
  file: Paperclip,
  select: ListChecks,
};

export function useTypeLabels() {
  const { t } = useI18n();
  return {
    text: t("Text"),
    number: t("Number"),
    file: t("Attachment"),
    select: t("Dropdown (single choice)"),
  } as Record<FieldType, string>;
}

/* ------------------------------ input per type ------------------------------ */

const NONE = "__none__";

export function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CandidateField;
  value: CustomValue | undefined;
  onChange: (v: CustomValue | undefined) => void;
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
      const r = await apiClient.uploadFile(file);
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
        {field.required ? " *" : ""}
      </Label>

      {field.type === "text" && (
        <Input id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
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

      {field.type === "select" && (
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

/** Read-only rendering for the candidate profile. */
export function CustomFieldValue({ field, value }: { field: CandidateField; value: CustomValue | undefined }) {
  const { t } = useI18n();
  if (isEmptyValue(value)) return <span className="text-muted-foreground">—</span>;
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
  return (
    <span dir={field.type === "number" ? "ltr" : "auto"} className="break-words">
      {String(value)}
    </span>
  );
}

/* ------------------------- Settings: manage the fields ------------------------ */

type Editing = { mode: "add" } | { mode: "edit"; field: CandidateField };

function FieldFormDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: Editing | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const typeLabels = useTypeLabels();
  const [label, setLabel] = useState("");
  const [labelCkb, setLabelCkb] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setError(null);
    if (editing.mode === "edit") {
      setLabel(editing.field.label);
      setLabelCkb(editing.field.labelCkb);
      setType(editing.field.type);
      setRequired(editing.field.required);
      setOptionsText(editing.field.options.join("\n"));
    } else {
      setLabel("");
      setLabelCkb("");
      setType("text");
      setRequired(false);
      setOptionsText("");
    }
  }, [editing]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!label.trim()) {
      setError("Field name is required");
      return;
    }
    const options = optionsText.split("\n").map((o) => o.trim()).filter(Boolean);
    if (type === "select" && options.length === 0) {
      setError("Add at least one option");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing.mode === "edit") {
        await apiClient.updateCandidateField(editing.field.id, {
          label,
          labelCkb,
          required,
          ...(type === "select" ? { options } : {}),
        });
        toast.success("Field updated");
      } else {
        await apiClient.createCandidateField({
          label,
          labelCkb,
          type,
          required,
          ...(type === "select" ? { options } : {}),
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
          {type === "select" && (
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
          <div className="flex items-center gap-2">
            <Checkbox id="field-required" checked={required} onCheckedChange={(c) => setRequired(c === true)} />
            <Label htmlFor="field-required" className="font-normal">
              {t("Required when saving a candidate")}
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

export function CandidateFieldsSettings() {
  const { t, locale } = useI18n();
  const typeLabels = useTypeLabels();
  const { fields, error, reload } = useCandidateFields();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<CandidateField | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [moving, setMoving] = useState(false);

  const atLimit = useMemo(() => (fields?.length ?? 0) >= MAX_FIELDS, [fields]);

  async function move(index: number, delta: -1 | 1) {
    if (!fields) return;
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    const ids = fields.map((f) => f.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
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
            {t("Add your own columns to the candidate profile: text, number, attachment or a dropdown with single choice. They appear in the candidate form and can be used as filters.")}
          </p>
        </div>
        <Button onClick={() => setEditing({ mode: "add" })} disabled={atLimit}>
          <Plus className="me-2 h-4 w-4" />
          {t("Add field")}
        </Button>
      </div>

      <div className="mt-4">
        {error && <ErrorState message={error} onRetry={reload} />}
        {!fields && !error && <TableSkeleton rows={3} />}
        {fields && fields.length === 0 && (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {t("No custom fields yet. Click “Add field” to create the first one.")}
          </p>
        )}
        {fields && fields.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {fields.map((f, i) => {
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
                      {f.type === "select" ? ` · ${t("{n} options", { n: f.options.length })}` : ""}
                    </p>
                  </div>
                  {f.required && (
                    <Badge variant="secondary" className="font-normal">
                      {t("Required")}
                    </Badge>
                  )}
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={t("Move up")}
                      disabled={i === 0 || moving}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={t("Move down")}
                      disabled={i === fields.length - 1 || moving}
                      onClick={() => move(i, 1)}
                    >
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
          </ul>
        )}
      </div>

      <FieldFormDialog editing={editing} onClose={() => setEditing(null)} onSaved={reload} />
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
