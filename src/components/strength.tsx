"use client";

// Candidate profile strength on screen: the badge, the bar and the explanation of one score.

import { createContext, useContext, useEffect, useState } from "react";
import { Check, Gauge, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient, StrengthExplain } from "@/lib/client";
import { describeRequirement } from "@/lib/job-requirements";
import { levelOf, strengthEnabled, StrengthConfig, StrengthLevel } from "@/lib/strength";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

let cache: StrengthConfig | null = null;

/** The strength setup (cached; refreshed each time a screen using it opens). null until it is loaded. */
export function useStrengthConfig(): StrengthConfig | null {
  const [cfg, setCfg] = useState<StrengthConfig | null>(cache);
  useEffect(() => {
    let live = true;
    apiClient
      .getStrengthConfig()
      .then((c) => {
        cache = c;
        if (live) setCfg(c);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return cfg;
}

const StrengthContext = createContext<StrengthConfig | null>(null);
/** One screen loads the setup once and shares it with all its cards. */
export const StrengthProvider = StrengthContext.Provider;
export const useStrength = () => useContext(StrengthContext);

/** Settings saved: later screens use the new setup straight away. */
export function setStrengthCache(c: StrengthConfig) {
  cache = c;
}

export const LEVEL_STYLE: Record<StrengthLevel, { badge: string; bar: string; dot: string }> = {
  strong: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  medium: { badge: "bg-amber-50 text-amber-700 border-amber-200", bar: "bg-amber-500", dot: "bg-amber-500" },
  weak: { badge: "bg-red-50 text-red-700 border-red-200", bar: "bg-red-400", dot: "bg-red-400" },
};

export function useLevelLabel() {
  const { t } = useI18n();
  return (l: StrengthLevel) => t(l === "strong" ? "Strong" : l === "medium" ? "Medium" : "Weak");
}

/** "Strong · 85%" — renders nothing when the strength is not set up. */
export function StrengthBadge({ score, config, className }: { score: number | undefined; config: StrengthConfig | null; className?: string }) {
  const { t } = useI18n();
  const label = useLevelLabel();
  if (!config || !strengthEnabled(config)) return null;
  const s = score ?? 0;
  const level = levelOf(s, config);
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none", LEVEL_STYLE[level].badge, className)}
      title={t("Profile strength: {n}%", { n: s })}
    >
      <Gauge className="h-3 w-3" />
      {label(level)} · <span dir="ltr">{s}%</span>
    </span>
  );
}

/** A thin bar of the score (for tables and wide cards). */
export function StrengthBar({ score, config, className }: { score: number | undefined; config: StrengthConfig | null; className?: string }) {
  if (!config || !strengthEnabled(config)) return null;
  const s = score ?? 0;
  const level = levelOf(s, config);
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-border", className)} role="progressbar" aria-valuenow={s} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", LEVEL_STYLE[level].bar)} style={{ width: `${s}%` }} />
    </div>
  );
}

/** The score of one candidate with every condition: met or not, and its points. Used in the application details. */
export function StrengthBreakdown({ candidateId }: { candidateId: string }) {
  const { t, locale } = useI18n();
  const label = useLevelLabel();
  const [data, setData] = useState<StrengthExplain | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    apiClient
      .candidateStrength(candidateId)
      .then((r) => live && setData(r))
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [candidateId]);

  if (data === undefined) return <Skeleton className="h-24 w-full rounded-lg" />;
  if (!data || !data.enabled) return null;
  const total = data.items.reduce((a, x) => a + x.weight, 0);
  const earned = data.items.filter((x) => x.met).reduce((a, x) => a + x.weight, 0);
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Profile strength")}</p>
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", LEVEL_STYLE[data.level].badge)}>
          <Gauge className="h-3.5 w-3.5" />
          {label(data.level)} · <span dir="ltr">{data.score}%</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
        <div className={cn("h-full rounded-full", LEVEL_STYLE[data.level].bar)} style={{ width: `${data.score}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("{earned} of {total} points", { earned, total })}</p>
      <ul className="mt-2 space-y-1">
        {data.items.map((x, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full", x.met ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
              {x.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            </span>
            <span className={cn("min-w-0 flex-1 break-words", !x.met && "text-muted-foreground")}>
              {describeRequirement({ rule: x.rule, label: x.label, labelCkb: x.labelCkb, fieldType: x.fieldType }, t, locale)}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground" dir="ltr">
              {x.met ? "+" : ""}
              {x.weight}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
