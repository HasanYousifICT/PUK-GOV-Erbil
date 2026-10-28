"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCandidateFields, useCandidateSections, useTypeLabels } from "@/components/candidate-fields";
import { SearchablePickerButton, SearchableSelect, SelectOption } from "@/components/searchable-select";
import { CandidateField, fieldLabel, hasOptions, sectionLabel } from "@/lib/candidate-fields";
import { CustomFilter, isStdField, OPS_BY_TYPE, opNeedsValue, STD_FIELDS, STD_OPS } from "@/lib/candidate-filters";
import { useI18n } from "@/lib/i18n";

const ANY = "__any__";

/** Rows of "field + operator + value" conditions. Used by the candidate filters and by the job requirements. */
export function CustomFilterRows({
  value: custom,
  onChange,
  title,
  addLabel,
  hint,
}: {
  value: CustomFilter[];
  onChange: (v: CustomFilter[]) => void;
  title?: string;
  addLabel?: string;
  hint?: string;
}) {
  const { t, locale } = useI18n();
  const typeLabels = useTypeLabels();
  const { fields } = useCandidateFields();
  const { sections } = useCandidateSections();
  const set = (patch: { custom: CustomFilter[] }) => onChange(patch.custom);

  const opLabels: Record<string, string> = {
    contains: t("contains"),
    equals: t("equals"),
    notEmpty: t("is filled"),
    empty: t("is empty"),
    eq: t("="),
    gte: t("at least"),
    lte: t("at most"),
    between: t("between"),
    is: t("is"),
    on: t("on"),
    after: t("on or after"),
    before: t("on or before"),
    includes: t("includes"),
  };

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
  function addFilter(id: string) {
    const f = allFields.find((x) => x.id === id);
    if (!f) return;
    set({ custom: [...custom, { fieldId: f.id, op: (isStdField(f.id) ? STD_OPS : OPS_BY_TYPE[f.type])[0], value: "" }] });
  }
  const fieldOf = (id: string): CandidateField | undefined => allFields.find((f) => f.id === id);

  return (
    <div>
      <div className="space-y-2 border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title ?? t("Field filters")}</p>
          <SearchablePickerButton options={pickerOptions} onPick={addFilter}>
            <Plus className="me-1.5 h-3.5 w-3.5" />
            {addLabel ?? t("Add field filter")}
          </SearchablePickerButton>
        </div>
        {custom.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {hint ?? t("Filter by any field: standard details or your own profile fields. Use the search box to find a field quickly.")}
          </p>
        )}
        {custom.map((c, i) => {
          const f = fieldOf(c.fieldId);
          if (!f) return null;
          const ops = isStdField(f.id) ? STD_OPS : OPS_BY_TYPE[f.type];
          return (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-2">
              <div className="w-56">
                <SearchableSelect
                  value={c.fieldId}
                  ariaLabel={t("Field")}
                  options={pickerOptions}
                  onChange={(id) => {
                    const nf = id ? fieldOf(id) : undefined;
                    if (nf) updateCustom(i, { fieldId: nf.id, op: (isStdField(nf.id) ? STD_OPS : OPS_BY_TYPE[nf.type])[0], value: "", value2: "" });
                  }}
                />
              </div>
              <div className="w-36">
                <Select value={c.op} onValueChange={(op) => updateCustom(i, { op, value: "", value2: "" })}>
                  <SelectTrigger aria-label={typeLabels[f.type]}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ops.map((op) => (
                      <SelectItem key={op} value={op}>
                        {opLabels[op]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {opNeedsValue(c.op) &&
                (f.type === "yesno" ? (
                  <div className="w-36">
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
                  <div className="w-56">
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
                      <Input
                        className="w-44"
                        dir="ltr"
                        type={f.type === "date" ? "date" : "number"}
                        step="any"
                        aria-label={t("Value")}
                        value={c.value2 ?? ""}
                        onChange={(e) => updateCustom(i, { value2: e.target.value })}
                      />
                    )}
                  </>
                ))}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label={t("Remove")}
                onClick={() => set({ custom: custom.filter((_, idx) => idx !== i) })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
