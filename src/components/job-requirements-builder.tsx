"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { CustomFilterRows } from "@/components/custom-filter-rows";
import { CustomFilter, isCustomFilterActive } from "@/lib/candidate-filters";
import { apiClient, RequirementsPreview } from "@/lib/client";
import { useI18n } from "@/lib/i18n";

/**
 * The requirements editor of a job: the condition cards plus a live check of how many existing candidates
 * would be able to apply (all conditions together, and each condition on its own).
 */
export function JobRequirementsBuilder({
  value,
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
  const { t } = useI18n();
  const [preview, setPreview] = useState<RequirementsPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const activeIdx = useMemo(() => value.map((c, i) => (isCustomFilterActive(c) ? i : -1)).filter((i) => i >= 0), [value]);
  const key = JSON.stringify(activeIdx.map((i) => value[i]));

  useEffect(() => {
    if (activeIdx.length === 0) {
      setPreview(null);
      setBusy(false);
      return;
    }
    let live = true;
    setBusy(true);
    const id = setTimeout(() => {
      apiClient
        .previewRequirements(activeIdx.map((i) => value[i]))
        .then((r) => live && setPreview(r))
        .catch(() => live && setPreview(null))
        .finally(() => live && setBusy(false));
    }, 600);
    return () => {
      live = false;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // counts per condition, in the order of the rows (conditions that are not complete yet have none)
  const counts = useMemo(() => {
    if (!preview) return null;
    const out: number[] = [];
    activeIdx.forEach((rowIndex, k) => {
      out[rowIndex] = preview.perRule[k] ?? 0;
    });
    return out;
  }, [preview, activeIdx]);

  const pct = preview && preview.total > 0 ? Math.round((preview.matching / preview.total) * 100) : 0;

  return (
    <div className="space-y-3">
      <CustomFilterRows title={title} addLabel={addLabel} hint={hint} value={value} onChange={onChange} counts={counts} total={preview?.total} />
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">{t("A candidate must meet all of these conditions to apply.")}</p>
      )}
      {activeIdx.length > 0 && (
        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-sm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Users className="h-4 w-4 text-primary" />}
            {preview ? (
              <span className="font-medium">
                {t("{n} of {total} candidates meet all the conditions", { n: preview.matching, total: preview.total })}
              </span>
            ) : (
              <span className="text-muted-foreground">{t("Checking how many candidates meet the conditions…")}</span>
            )}
            {preview && preview.total > 0 && <span className="ms-auto text-xs font-semibold tabular-nums text-muted-foreground">{pct}%</span>}
          </div>
          {preview && preview.total > 0 && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
          {preview?.truncated && <p className="mt-1.5 text-[11px] text-muted-foreground">{t("Only the first 20000 candidates were checked.")}</p>}
        </div>
      )}
    </div>
  );
}
