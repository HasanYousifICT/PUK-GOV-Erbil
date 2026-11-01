"use client";

import { useEffect, useState } from "react";
import { Briefcase, Gauge, Loader2, Pencil, RotateCcw } from "lucide-react";
import { toast } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StrengthFieldsEditor } from "@/components/strength-fields-editor";
import { useCandidateFields } from "@/components/candidate-fields";
import { LEVEL_STYLE, setStrengthCache, useLevelLabel } from "@/components/strength";
import { apiClient, StrengthJob, StrengthSaved } from "@/lib/client";
import { fieldLabel } from "@/lib/candidate-fields";
import { DEFAULT_MEDIUM_MIN, DEFAULT_STRONG_MIN, parseStrengthConfig, StrengthConfig, StrengthFieldRule, weightsComplete } from "@/lib/strength";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** "Education level 50% · Experience 25%…" */
function FieldSummary({ fields }: { fields: StrengthFieldRule[] }) {
  const { locale } = useI18n();
  const { fields: defs } = useCandidateFields();
  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((f) => {
        const d = (defs ?? []).find((x) => x.id === f.fieldId);
        return (
          <Badge key={f.fieldId} variant="secondary" className="font-normal">
            {d ? fieldLabel(d, locale) : f.fieldId} · <span dir="ltr">{f.weight}%</span>
          </Badge>
        );
      })}
    </div>
  );
}

/**
 * Settings → Candidate strength (administrators): the official (general) setup for every job, then the jobs that
 * have their own setup, one by one. Each field has its percentage of the total (100%) and a "stronger" condition.
 */
export function StrengthSettings() {
  const { t } = useI18n();
  const label = useLevelLabel();
  const [cfg, setCfg] = useState<StrengthConfig | null>(null);
  const [strongMin, setStrongMin] = useState(String(DEFAULT_STRONG_MIN));
  const [mediumMin, setMediumMin] = useState(String(DEFAULT_MEDIUM_MIN));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StrengthSaved | null>(null);
  const [jobs, setJobs] = useState<StrengthJob[] | null>(null);
  const [editing, setEditing] = useState<{ job: StrengthJob; fields: StrengthFieldRule[] } | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const loadJobs = () =>
    apiClient
      .strengthJobs()
      .then(setJobs)
      .catch(() => setJobs([]));

  useEffect(() => {
    apiClient
      .getStrengthConfig()
      .then((c) => {
        setCfg(c);
        setStrongMin(String(c.strongMin));
        setMediumMin(String(c.mediumMin));
      })
      .catch(() => setCfg(parseStrengthConfig("")));
    loadJobs();
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
  const canSave = cfg.fields.length === 0 || weightsComplete(cfg.fields);

  async function save() {
    if (!cfg) return;
    setBusy(true);
    try {
      const r = await apiClient.setStrengthConfig({ fields: cfg.fields, strongMin: strongN, mediumMin: mediumN });
      setStrengthCache(r.config);
      setCfg(r.config);
      setStrongMin(String(r.config.strongMin));
      setMediumMin(String(r.config.mediumMin));
      setResult(r);
      setJobs(r.jobs);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function saveJob() {
    if (!editing) return;
    setEditBusy(true);
    try {
      await apiClient.updateJob(editing.job.id, { strength: editing.fields });
      toast.success("Job updated");
      setEditing(null);
      await loadJobs();
      apiClient.getStrengthConfig().then((c) => (setStrengthCache(c), setCfg((x) => (x ? { ...x, modifiedJobs: c.modifiedJobs } : x)))).catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setEditBusy(false);
    }
  }

  async function resetJob(j: StrengthJob) {
    try {
      await apiClient.updateJob(j.id, { strength: null });
      toast.success("Job updated");
      await loadJobs();
      apiClient.getStrengthConfig().then((c) => (setStrengthCache(c), setCfg((x) => (x ? { ...x, modifiedJobs: c.modifiedJobs } : x)))).catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
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
            <h3 className="font-semibold">{t("Official candidate strength")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("Choose the profile fields that make an applicant stronger and give each one its percentage of the total (100%). For each job, the applicants are compared with each other, and the one with the best answers on the most important fields is the strongest. This setup applies to every job, open or new, unless a job has its own.")}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <StrengthFieldsEditor value={cfg.fields} onChange={(fields) => setCfg({ ...cfg, fields })} />
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
        <Button onClick={save} disabled={busy || !canSave}>
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

      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <Briefcase className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="flex flex-wrap items-center gap-2 font-semibold">
              {t("Jobs with their own strength")}
              {jobs && <span className="rounded-full bg-muted px-2 py-px text-xs tabular-nums">{jobs.length}</span>}
            </h3>
            <p className="text-sm text-muted-foreground">{t("These jobs do not follow the official setup above: their strength was changed when the job was opened or edited. Use the job filter in Jobs to find them too.")}</p>
          </div>
        </div>
        {jobs === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("Loading…")}
          </div>
        ) : jobs.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{t("No job has its own strength. Every job follows the official setup.")}</p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((j) => (
              <li key={j.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{j.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {j.status === "Open" ? t("Open") : t("Closed")} · {t("{n} applications", { n: j.applications })}
                      {j.location ? ` · ${j.location}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing({ job: j, fields: j.fields.map((x) => ({ ...x })) })}>
                      <Pencil className="me-1.5 h-3.5 w-3.5" />
                      {t("Edit")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => resetJob(j)}>
                      <RotateCcw className="me-1.5 h-3.5 w-3.5" />
                      {t("Use the official setup")}
                    </Button>
                  </div>
                </div>
                <div className="mt-2">
                  <FieldSummary fields={j.fields} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.job.title}</DialogTitle>
            <DialogDescription>{t("Candidate strength for this job only")}</DialogDescription>
          </DialogHeader>
          {editing && <StrengthFieldsEditor value={editing.fields} onChange={(fields) => setEditing({ ...editing, fields })} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={editBusy}>
              {t("Cancel")}
            </Button>
            <Button type="button" onClick={saveJob} disabled={editBusy || !editing || !weightsComplete(editing.fields)}>
              {editBusy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("Save changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
