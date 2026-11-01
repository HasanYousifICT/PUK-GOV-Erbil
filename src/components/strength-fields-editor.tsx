"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchablePickerButton, SelectOption } from "@/components/searchable-select";
import { useCandidateFields, useCandidateSections } from "@/components/candidate-fields";
import { CandidateField, fieldLabel, sectionLabel } from "@/lib/candidate-fields";
import { effectiveOrder, splitEqually, StrengthFieldRule, sumWeights, weightsComplete } from "@/lib/strength";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** The two directions of a field, worded for its type. */
function dirLabels(type: CandidateField["type"]): [string, string] {
  switch (type) {
    case "select":
      return ["Later options in the list are stronger", "Earlier options in the list are stronger"];
    case "number":
      return ["From smallest to highest (highest is stronger)", "From highest to smallest (smallest is stronger)"];
    case "date":
      return ["Newest date is stronger", "Oldest date is stronger"];
    case "yesno":
      return ["Yes is stronger", "No is stronger"];
    case "multiselect":
    case "table":
      return ["More is stronger", "Fewer is stronger"];
    case "file":
      return ["Uploaded is stronger", "Not uploaded is stronger"];
    default:
      return ["Filled in is stronger", "Empty is stronger"];
  }
}

/** A percentage box that lets you type "16." or "16.6" without the cursor jumping. */
function PercentInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        dir="ltr"
        aria-label={label}
        className="h-8 w-24 pe-7 text-end tabular-nums"
        value={text}
        onChange={(e) => {
          const v = e.target.value.replace(",", ".");
          if (!/^\d{0,3}(\.\d{0,2})?$/.test(v)) return;
          setText(v);
          const n = Number(v);
          onChange(Number.isFinite(n) ? Math.min(100, n) : 0);
        }}
      />
      <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
    </div>
  );
}

/**
 * The fields that rank the applicants, each with its percentage of the total (the total must be 100%) and its own
 * "which answer is stronger" condition. Used by Settings (the general setup) and by a job with its own setup.
 */
export function StrengthFieldsEditor({ value, onChange }: { value: StrengthFieldRule[]; onChange: (v: StrengthFieldRule[]) => void }) {
  const { t, locale } = useI18n();
  const { fields } = useCandidateFields();
  const { sections } = useCandidateSections();
  const all = fields ?? [];
  const byId = new Map(all.map((f) => [f.id, f]));
  const chosen = new Set(value.map((f) => f.fieldId));
  const rows = value.filter((r) => byId.has(r.fieldId));
  const sectionName = (sid: string) => {
    const sec = (sections ?? []).find((x) => x.id === sid) ?? (sections ?? [])[0];
    return sec ? sectionLabel(sec, locale) : "";
  };
  const pickerOptions: SelectOption[] = all.filter((f) => !chosen.has(f.id)).map((f) => ({ value: f.id, label: fieldLabel(f, locale), group: sectionName(f.sectionId) }));

  // a field deleted from the profile since the setup was saved drops out (so the 100% still adds up)
  useEffect(() => {
    if (fields && value.some((r) => !byId.has(r.fieldId))) onChange(value.filter((r) => byId.has(r.fieldId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const used = sumWeights(rows);
  const available = Math.round((100 - used) * 100) / 100;
  const complete = weightsComplete(rows);
  const over = used > 100.05;

  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const equalise = () => {
    const next = value.map((x) => ({ ...x }));
    splitEqually(next);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Fields that rank applicants")}</p>
        <div className="flex items-center gap-1.5">
          {rows.length > 1 && (
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={equalise}>
              <Scale className="me-1.5 h-3.5 w-3.5" />
              {t("Split equally")}
            </Button>
          )}
          <SearchablePickerButton options={pickerOptions} onPick={(id) => onChange([...value, { fieldId: id, dir: "high", weight: Math.max(0, available) }])}>
            <Plus className="me-1.5 h-3.5 w-3.5" />
            {t("Add field")}
          </SearchablePickerButton>
        </div>
      </div>

      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          {t("No fields yet. Add the profile fields that make an applicant stronger (education, experience, languages…). Until you add some, strength is not shown.")}
        </p>
      )}

      {rows.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold">
              {t("Total")} <span dir="ltr">100%</span>
            </span>
            <span className="flex flex-wrap items-center gap-3 text-xs">
              <span className={cn("font-medium", over ? "text-red-600" : "text-foreground")}>
                {t("Used")} <span dir="ltr">{used}%</span>
              </span>
              <span className={cn("font-medium", complete ? "text-emerald-700" : over ? "text-red-600" : "text-amber-700")}>
                {over ? t("Over by") : t("Available")} <span dir="ltr">{Math.abs(available)}%</span>
              </span>
            </span>
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={Math.min(100, used)} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn("h-full transition-all", over ? "bg-red-500" : complete ? "bg-emerald-500" : "bg-primary")} style={{ width: `${Math.min(100, used)}%` }} />
          </div>
          {!complete && <p className="mt-1.5 text-xs text-amber-700">{t("The percentages must add up to exactly 100% before you can save.")}</p>}
        </div>
      )}

      {rows.map((r) => {
        const f = byId.get(r.fieldId)!;
        const [hi, lo] = dirLabels(f.type);
        const idx = value.findIndex((x) => x.fieldId === r.fieldId);
        const patch = (p: Partial<StrengthFieldRule>) => onChange(value.map((x) => (x.fieldId === r.fieldId ? { ...x, ...p } : x)));
        const isSelect = f.type === "select";
        const isMulti = f.type === "multiselect";
        const byBest = isMulti && r.by === "best";
        const showOrder = (isSelect || byBest) && f.options.length > 0;
        const order = showOrder ? effectiveOrder(f, r) : [];
        const moveOpt = (k: number, d: -1 | 1) => {
          const n = [...order];
          const j = k + d;
          if (j < 0 || j >= n.length) return;
          [n[k], n[j]] = [n[j], n[k]];
          patch({ order: n });
        };
        return (
          <div key={r.fieldId} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{fieldLabel(f, locale)}</span>
              <PercentInput value={r.weight} label={t("Percentage of the total")} onChange={(n) => patch({ weight: n })} />
              {isMulti && (
                <select
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                  value={r.by === "best" ? "best" : "count"}
                  aria-label={t("Rank by")}
                  onChange={(e) => patch({ by: e.target.value === "best" ? "best" : "count", order: e.target.value === "best" ? effectiveOrder(f, r) : r.order })}
                >
                  <option value="count">{t("Number of answers ticked")}</option>
                  <option value="best">{t("Best answer ticked")}</option>
                </select>
              )}
              {!isSelect && !byBest && (
                <select
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                  value={r.dir}
                  aria-label={t("Which answer is stronger")}
                  onChange={(e) => patch({ dir: e.target.value === "low" ? "low" : "high" })}
                >
                  <option value="high">{t(hi)}</option>
                  <option value="low">{t(lo)}</option>
                </select>
              )}
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={idx === 0} onClick={() => move(idx, -1)} aria-label={t("Move up")}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={idx === value.length - 1} onClick={() => move(idx, 1)} aria-label={t("Move down")}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => onChange(value.filter((x) => x.fieldId !== r.fieldId))} aria-label={t("Remove")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {showOrder && (
              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{t("Sort the options: the strongest on top, the weakest at the bottom")}</p>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => patch({ order: [...order].reverse() })}>
                    <ArrowUpDown className="me-1 h-3.5 w-3.5" />
                    {t("Reverse")}
                  </Button>
                </div>
                <ol className="max-h-72 space-y-1 overflow-y-auto">
                  {order.map((o, k) => (
                    <li key={o} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background text-[10px] tabular-nums text-muted-foreground">{k + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{o}</span>
                      {k === 0 && <span className="shrink-0 text-[10px] font-semibold text-emerald-700">{t("Strongest")}</span>}
                      {k === order.length - 1 && order.length > 1 && <span className="shrink-0 text-[10px] font-semibold text-red-600">{t("Weakest")}</span>}
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={k === 0} onClick={() => moveOpt(k, -1)} aria-label={t("Move up")}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={k === order.length - 1} onClick={() => moveOpt(k, 1)} aria-label={t("Move down")}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
