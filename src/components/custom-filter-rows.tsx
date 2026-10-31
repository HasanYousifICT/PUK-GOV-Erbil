"use client";

import { useState } from "react";
import { Check, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCandidateFields, useCandidateSections, useTypeLabels } from "@/components/candidate-fields";
import { MultiSelect, SearchablePickerButton, SearchableSelect, SelectOption } from "@/components/searchable-select";
import { CandidateField, fieldLabel, hasOptions, sectionLabel } from "@/lib/candidate-fields";
import { CustomFilter, isCustomFilterActive, isListOp, isStdField, MAX_LIST_VALUES, opLabels, OPS_BY_TYPE, opNeedsValue, STD_FIELDS, STD_OPS } from "@/lib/candidate-filters";
import { describeRequirement } from "@/lib/job-requirements";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ANY = "__any__";

/** Several typed values (type a word, press Enter or comma). Used by "contains any of" / "is any of" on text fields. */
function TagsInput({ values, onChange, placeholder, ariaLabel }: { values: string[]; onChange: (v: string[]) => void; placeholder: string; ariaLabel: string }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  function add(raw: string) {
    const parts = raw
      .split(/[,،\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length) onChange(Array.from(new Set([...values, ...parts])).slice(0, MAX_LIST_VALUES));
    setText("");
  }
  return (
    <div className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1 focus-within:ring-2 focus-within:ring-ring/40">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary" dir="auto">
          {v}
          <button type="button" aria-label={t("Remove")} className="rounded hover:bg-primary/20" onClick={() => onChange(values.filter((x) => x !== v))}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        aria-label={ariaLabel}
        dir="auto"
        className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none"
        value={text}
        placeholder={values.length ? "" : placeholder}
        onChange={(e) => (/[,،]/.test(e.target.value) ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(text);
          } else if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => add(text)}
      />
    </div>
  );
}

/**
 * Rows of "field + operator + value" conditions. Used by the candidate filters and by the job requirements.
 * Every condition is a numbered card with a plain-language sentence; all conditions must be met together.
 */
export function CustomFilterRows({
  value: custom,
  onChange,
  title,
  addLabel,
  hint,
  counts,
  total,
}: {
  value: CustomFilter[];
  onChange: (v: CustomFilter[]) => void;
  title?: string;
  addLabel?: string;
  hint?: string;
  /** optional: how many candidates meet each condition on its own (same order as `value`) */
  counts?: number[] | null;
  total?: number;
}) {
  const { t, locale } = useI18n();
  const typeLabels = useTypeLabels();
  const { fields } = useCandidateFields();
  const { sections } = useCandidateSections();
  const set = (patch: { custom: CustomFilter[] }) => onChange(patch.custom);
  const ops = opLabels(t);

  const blank = { value: "", value2: "", values: undefined };
  function updateCustom(i: number, patch: Partial<CustomFilter>) {
    set({ custom: custom.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  }
  // every searchable field: the standard ones first, then the profile fields grouped by section
  const stdFields: CandidateField[] = STD_FIELDS.map((x, i) => ({
    id: x.id,
    label: t(x.label),
    labelCkb: "",
    type: "text",
    options: [],
    required: false,
    publicForm: false,
    sectionId: "",
    showIf: null,
    columns: [],
    settings: {},
    sortOrder: i,
  }));
  const allFields: CandidateField[] = [...stdFields, ...(fields ?? [])];
  const sectionName = (sid: string) => {
    const sec = (sections ?? []).find((x) => x.id === sid) ?? (sections ?? [])[0];
    return sec ? sectionLabel(sec, locale) : "";
  };
  const pickerOptions: SelectOption[] = [
    ...stdFields.map((x) => ({ value: x.id, label: x.label, group: t("Standard fields") })),
    ...(fields ?? []).map((x) => ({ value: x.id, label: fieldLabel(x, locale), group: sectionName(x.sectionId) })),
  ];
  const opsOf = (f: CandidateField) => (isStdField(f.id) ? STD_OPS : OPS_BY_TYPE[f.type]);
  function addFilter(id: string) {
    const f = allFields.find((x) => x.id === id);
    if (!f) return;
    set({ custom: [...custom, { fieldId: f.id, op: opsOf(f)[0], value: "" }] });
  }
  const fieldOf = (id: string): CandidateField | undefined => allFields.find((f) => f.id === id);

  return (
    <div>
      <div className="space-y-3 border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {title ?? t("Field filters")}
            {custom.length > 0 && <span className="rounded-full bg-muted px-1.5 py-px text-[10px] tabular-nums">{custom.length}</span>}
          </p>
          <div className="flex items-center gap-1.5">
            {custom.length > 1 && (
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => set({ custom: [] })}>
                <Trash2 className="me-1.5 h-3.5 w-3.5" />
                {t("Clear all")}
              </Button>
            )}
            <SearchablePickerButton options={pickerOptions} onPick={addFilter}>
              <Plus className="me-1.5 h-3.5 w-3.5" />
              {addLabel ?? t("Add field filter")}
            </SearchablePickerButton>
          </div>
        </div>
        {custom.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            {hint ?? t("Filter by any field: standard details or your own profile fields. Use the search box to find a field quickly.")}
          </p>
        )}
        {custom.map((c, i) => {
          const f = fieldOf(c.fieldId);
          if (!f) return null;
          const opList = opsOf(f);
          const list = isListOp(c.op);
          const active = isCustomFilterActive(c);
          const n = counts?.[i];
          return (
            <div key={i}>
              {i > 0 && (
                <div className="flex items-center gap-2 py-1.5" aria-hidden>
                  <span className="h-px flex-1 bg-border" />
                  <span className="rounded-full border bg-muted/40 px-2 py-px text-[10px] font-semibold tracking-wide text-muted-foreground">{t("AND")}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <div className="rounded-xl border bg-card shadow-sm">
                <div className="flex items-start gap-3 p-3">
                  <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
                      <SearchableSelect
                        value={c.fieldId}
                        ariaLabel={t("Field")}
                        options={pickerOptions}
                        onChange={(id) => {
                          const nf = id ? fieldOf(id) : undefined;
                          if (nf) updateCustom(i, { fieldId: nf.id, op: opsOf(nf)[0], ...blank });
                        }}
                      />
                      <Select value={c.op} onValueChange={(op) => updateCustom(i, { op, ...blank })}>
                        <SelectTrigger aria-label={typeLabels[f.type]}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {opList.map((op) => (
                            <SelectItem key={op} value={op}>
                              {ops[op]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {opNeedsValue(c.op) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {list && hasOptions(f.type) ? (
                          <div className="min-w-0 flex-1">
                            <MultiSelect
                              values={c.values ?? []}
                              ariaLabel={t("Values")}
                              placeholder={t("Select one or more options")}
                              options={f.options.map((o) => ({ value: o, label: o }))}
                              onChange={(values) => updateCustom(i, { values, value: "" })}
                            />
                          </div>
                        ) : list ? (
                          <div className="min-w-0 flex-1">
                            <TagsInput
                              values={c.values ?? []}
                              ariaLabel={t("Values")}
                              placeholder={t("Type a value and press Enter")}
                              onChange={(values) => updateCustom(i, { values, value: "" })}
                            />
                          </div>
                        ) : f.type === "yesno" ? (
                          <div className="w-40">
                            <Select value={c.value || ANY} onValueChange={(v) => updateCustom(i, { value: v === ANY ? "" : v })}>
                              <SelectTrigger aria-label={t("Value")}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={ANY}>{t("Select an option")}</SelectItem>
                                <SelectItem value="yes">{t("Yes")}</SelectItem>
                                <SelectItem value="no">{t("No")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : hasOptions(f.type) ? (
                          <div className="min-w-0 flex-1">
                            <SearchableSelect
                              value={c.value || undefined}
                              ariaLabel={t("Select an option")}
                              noneLabel={t("Select an option")}
                              options={f.options.map((o) => ({ value: o, label: o }))}
                              onChange={(v) => updateCustom(i, { value: v ?? "" })}
                            />
                          </div>
                        ) : (
                          <>
                            <Input
                              className="w-44"
                              dir={f.type === "number" || f.type === "date" ? "ltr" : "auto"}
                              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                              step="any"
                              aria-label={t("Value")}
                              value={c.value ?? ""}
                              onChange={(e) => updateCustom(i, { value: e.target.value })}
                            />
                            {c.op === "between" && (
                              <>
                                <span className="text-xs text-muted-foreground">{t("and")}</span>
                                <Input
                                  className="w-44"
                                  dir="ltr"
                                  type={f.type === "date" ? "date" : "number"}
                                  step="any"
                                  aria-label={t("Value")}
                                  value={c.value2 ?? ""}
                                  onChange={(e) => updateCustom(i, { value2: e.target.value })}
                                />
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs", active ? "bg-muted/50 text-foreground/80" : "bg-amber-50 text-amber-700")}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        {active ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : null}
                        <span className="min-w-0 break-words">
                          {active
                            ? describeRequirement({ rule: c, label: f.label, labelCkb: f.labelCkb, fieldType: f.type }, t, locale)
                            : t("Choose a value to complete this condition")}
                        </span>
                      </span>
                      {active && n !== undefined && total !== undefined && (
                        <span className="shrink-0 rounded-full bg-background px-2 py-px font-medium tabular-nums text-muted-foreground">
                          {t("{n} of {total} candidates", { n, total })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600" aria-label={t("Remove")} onClick={() => set({ custom: custom.filter((_, idx) => idx !== i) })}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
