"use client";

import { useEffect, useState } from "react";
import { Gauge, Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomFilterRows } from "@/components/custom-filter-rows";
import { LEVEL_STYLE, setStrengthCache, useLevelLabel } from "@/components/strength";
import { apiClient, StrengthSaved } from "@/lib/client";
import { DEFAULT_MEDIUM_MIN, DEFAULT_STRONG_MIN, parseStrengthConfig, StrengthConfig } from "@/lib/strength";
import { isCustomFilterActive } from "@/lib/candidate-filters";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Settings → Candidate strength (administrators): choose, once for everyone, the profile fields and conditions that
 * make a candidate strong. Each condition is worth points; the score is the share of points a candidate earns.
 */
export function StrengthSettings() {
  const { t } = useI18n();
  const label = useLevelLabel();
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

  const strongN = Math.min(100, Math.max(2, Math.round(Number(strongMin)) || DEFAULT_STRONG_MIN));
  const mediumN = Math.min(strongN - 1, Math.max(1, Math.round(Number(mediumMin)) || DEFAULT_MEDIUM_MIN));
  const active = cfg.rules.filter(isCustomFilterActive);
  const totalPoints = active.reduce((a, r) => a + (r.weight && r.weight > 0 ? r.weight : 10), 0);

  async function save() {
    if (!cfg) return;
    setBusy(true);
    try {
      const r = await apiClient.setStrengthConfig({ rules: active, strongMin: strongN, mediumMin: mediumN });
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
              {t("Choose, once for everyone, the profile fields and conditions that make a candidate strong. Each condition is worth points. A candidate's strength is the share of points they earn, from 0 to 100, and it is shown on every application with the strongest candidates first.")}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <CustomFilterRows
          weights
          title={t("Strength conditions")}
          addLabel={t("Add condition")}
          hint={t("No conditions yet. Add the fields that matter (education, experience, languages…) and how many points each one is worth. Until you add some, strength is not shown.")}
          value={cfg.rules}
          onChange={(rules) => setCfg({ ...cfg, rules })}
        />
        {active.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("Total points: {n}", { n: totalPoints })} · {t("A candidate who meets every condition scores 100.")}
          </p>
        )}
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
        <p className="text-xs text-muted-foreground">{t("Scores also update automatically whenever a candidate profile is saved.")}</p>
      </div>

      {result && (
        <div className="rounded-xl border bg-muted/30 p-4 text-sm">
          <p className="font-medium">{t("Recalculated {n} candidates", { n: result.total })}</p>
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
