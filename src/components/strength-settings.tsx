"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Gauge, Loader2, Plus, X } from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchablePickerButton, SelectOption } from "@/components/searchable-select";
import { useCandidateFields, useCandidateSections } from "@/components/candidate-fields";
import { LEVEL_STYLE, setStrengthCache, useLevelLabel } from "@/components/strength";
import { apiClient, StrengthSaved } from "@/lib/client";
import { CandidateField, fieldLabel, sectionLabel } from "@/lib/candidate-fields";
import { DEFAULT_MEDIUM_MIN, DEFAULT_STRONG_MIN, effectiveOrder, parseStrengthConfig, StrengthConfig, StrengthFieldRule } from "@/lib/strength";
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

/**
 * Settings → Candidate strength (administrators): choose only the profile fields. No points: for every job the
 * applicants are ranked against each other on those fields (e.g. a Bachelor ranks above High school).
 */
export function StrengthSettings() {
  const { t, locale } = useI18n();
  const label = useLevelLabel();
  const { fields } = useCandidateFields();
  const { sections } = useCandidateSections();
  const [cfg, setCfg] = useState<StrengthConfig | null>(null);
  const [strongMin, setStrongMin] = useState(String(DEFAULT_STRONG_MIN));
  const [mediumMin, setMediumMin] = useState(String(DEFAULT_MEDIUM_MIN));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StrengthSaved | null>(null);

  useEffect(() => {
    apiClient
      .getStrengthConfig()
      .then((c) => {
        setCfg(c);
        setStrongMin(String(c.strongMin));
        setMediumMin(String(c.mediumMin));
      })
      .catch(() => setCfg(parseStrengthConfig("")));
  }, []);

  if (!cfg) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("Loading…")}
      </div>
    );
  }

  const all = fields ?? [];
  const byId = new Map(all.map((f) => [f.id, f]));
  const chosen = new Set(cfg.fields.map((f) => f.fieldId));
  const sectionName = (sid: string) => {
    const sec = (sections ?? []).find((x) => x.id === sid) ?? (sections ?? [])[0];
    return sec ? sectionLabel(sec, locale) : "";
  };
  const pickerOptions: SelectOption[] = all.filter((f) => !chosen.has(f.id)).map((f) => ({ value: f.id, label: fieldLabel(f, locale), group: sectionName(f.sectionId) }));
  const rows = cfg.fields.filter((r) => byId.has(r.fieldId));

  const strongN = Math.min(100, Math.max(2, Math.round(Number(strongMin)) || DEFAULT_STRONG_MIN));
  const mediumN = Math.min(strongN - 1, Math.max(1, Math.round(Number(mediumMin)) || DEFAULT_MEDIUM_MIN));

  const setFields = (next: StrengthConfig["fields"]) => setCfg({ ...cfg, fields: next });
  const move = (i: number, d: -1 | 1) => {
    const next = [...cfg.fields];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setFields(next);
  };

  async function save() {
    if (!cfg) return;
    setBusy(true);
    try {
      const r = await apiClient.setStrengthConfig({ fields: rows, strongMin: strongN, mediumMin: mediumN });
      setStrengthCache(r.config);
      setCfg(r.config);
      setStrongMin(String(r.config.strongMin));
      setMediumMin(String(r.config.mediumMin));
      setResult(r);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const ranges: { level: "strong" | "medium" | "weak"; text: string }[] = [
    { level: "strong", text: `${strongN} – 100` },
    { level: "medium", text: `${mediumN} – ${strongN - 1}` },
    { level: "weak", text: `0 – ${mediumN - 1}` },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Gauge className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold">{t("Candidate strength")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("Choose only the profile fields that matter. There are no points: for each job, the applicants are compared with each other on those fields, and the one with the best answers is the strongest. For example, with Education level chosen, an applicant with a Bachelor ranks above one with High school.")}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Fields that rank applicants")}</p>
          <SearchablePickerButton options={pickerOptions} onPick={(id) => setFields([...cfg.fields, { fieldId: id, dir: "high" }])}>
            <Plus className="me-1.5 h-3.5 w-3.5" />
            {t("Add field")}
          </SearchablePickerButton>
        </div>
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            {t("No fields yet. Add the profile fields that make an applicant stronger (education, experience, languages…). Until you add some, strength is not shown.")}
          </p>
        )}
        {rows.map((r) => {
          const f = byId.get(r.fieldId)!;
          const [hi, lo] = dirLabels(f.type);
          const idx = cfg.fields.findIndex((x) => x.fieldId === r.fieldId);
          const patch = (p: Partial<StrengthFieldRule>) => setFields(cfg.fields.map((x) => (x.fieldId === r.fieldId ? { ...x, ...p } : x)));
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
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={idx === cfg.fields.length - 1} onClick={() => move(idx, 1)} aria-label={t("Move down")}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setFields(cfg.fields.filter((x) => x.fieldId !== r.fieldId))} aria-label={t("Remove")}>
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
        {rows.length > 1 && <p className="text-xs text-muted-foreground">{t("Every chosen field counts equally.")}</p>}
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <h3 className="font-semibold">{t("Strength levels")}</h3>
          <p className="text-sm text-muted-foreground">{t("The score from which a profile counts as Strong or Medium. Below Medium it is Weak.")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="str-strong" className="text-xs">
              {t("Strong from")}
            </Label>
            <Input id="str-strong" type="number" min={2} max={100} dir="ltr" className="w-28" value={strongMin} onChange={(e) => setStrongMin(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="str-medium" className="text-xs">
              {t("Medium from")}
            </Label>
            <Input id="str-medium" type="number" min={1} max={99} dir="ltr" className="w-28" value={mediumMin} onChange={(e) => setMediumMin(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {ranges.map((r) => (
              <span key={r.level} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", LEVEL_STYLE[r.level].badge)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", LEVEL_STYLE[r.level].dot)} />
                {label(r.level)} <span dir="ltr">{r.text}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t("Save and recalculate")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("Scores also update automatically when someone applies, is removed, or a profile is saved.")}</p>
      </div>

      {result && (
        <div className="rounded-xl border bg-muted/30 p-4 text-sm">
          <p className="font-medium">{t("Ranked {n} applications", { n: result.total })}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["strong", "medium", "weak"] as const).map((l) => (
              <span key={l} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", LEVEL_STYLE[l].badge)}>
                {label(l)} <span className="tabular-nums">{result.levels[l]}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
