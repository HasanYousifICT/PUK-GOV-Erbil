"use client";
import { JobTitleText } from "@/components/job-title-text";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pager } from "@/components/pager";
import { apiClient, ApiClientError, PortalMyJob, PortalOpenJob, PortalRequirement, Quota } from "@/lib/client";
import { describeRequirement } from "@/lib/job-requirements";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/lib/notify";

const PAGE = 10;

function QuotaBar({ quota }: { quota: Quota | null }) {
  const { t } = useI18n();
  if (!quota) return null;
  return (
    <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-3 text-sm shadow-sm">
      <span>
        {t("Jobs applied")}: <b>{quota.used}</b>
      </span>
      {quota.remaining === null ? (
        <span className="text-muted-foreground">{t("No limit on applications")}</span>
      ) : (
        <>
          <span>
            {t("Maximum")}: <b>{quota.max}</b>
          </span>
          <span>
            {t("Remaining")}: <b>{quota.remaining}</b>
          </span>
        </>
      )}
    </div>
  );
}

function RequirementList({ items }: { items: PortalRequirement[] }) {
  const { t, locale } = useI18n();
  return (
    <ul className="space-y-1">
      {items.map((r, i) => (
        <li key={i} className={`flex items-start gap-2 text-sm ${r.met ? "text-emerald-700" : "text-red-700"}`}>
          {r.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{describeRequirement(r, t, locale)}</span>
        </li>
      ))}
    </ul>
  );
}

export function OpenJobs({ onApplied }: { onApplied: () => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PortalOpenJob[]>([]);
  const [total, setTotal] = useState(0);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiClient.candidateJobs({ q: q.trim() || undefined, page, pageSize: PAGE });
      setItems(r.items);
      setTotal(r.total);
      setQuota(r.quota);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  async function apply(job: PortalOpenJob) {
    setBusyId(job.id);
    try {
      await apiClient.candidateApplyJob(job.id);
      toast.success("Your application has been sent");
      await load();
      onApplied();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(msg);
      if (e instanceof ApiClientError) await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <QuotaBar quota={quota} />
      <Input
        placeholder={t("Search jobs")}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{t(error)}</p>}
      {loading && items.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("There are no open jobs right now.")}</p>
      ) : (
        items.map((j) => {
          const unmet = j.requirements.filter((r) => !r.met);
          const limitReached = quota?.remaining === 0;
          return (
            <div key={j.id} className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold"><JobTitleText title={j.title} ckb={j.titleCkb} /></h3>
                  <p className="text-xs text-muted-foreground">
                    {[j.location, t(j.employmentType), j.salary].filter(Boolean).join(" · ")}
                  </p>
                  {j.specialist && j.specialistNote && <p className="text-xs font-medium text-amber-700">{t("Specialist")}: {j.specialistNote}</p>}
                </div>
                {j.applied ? (
                  <Badge variant="secondary">{t("Applied")}</Badge>
                ) : (
                  <Button size="sm" disabled={!j.canApply || busyId === j.id} onClick={() => apply(j)}>
                    {busyId === j.id && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
                    {t("Apply")}
                  </Button>
                )}
              </div>
              {j.description && <p className="whitespace-pre-wrap text-sm">{j.description}</p>}
              {j.skills && (
                <p className="text-sm">
                  <b>{t("Skills")}:</b> {j.skills}
                </p>
              )}
              {j.experience && (
                <p className="text-sm">
                  <b>{t("Experience")}:</b> {j.experience}
                </p>
              )}
              {(j.requirements.length > 0 || j.requirementsNote) && (
                <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Requirements")}</p>
                  {j.requirements.length > 0 && <RequirementList items={j.requirements} />}
                  {j.requirementsNote && <p className="whitespace-pre-wrap text-sm">{j.requirementsNote}</p>}
                </div>
              )}
              {!j.applied && unmet.length > 0 && (
                <div className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p className="font-medium">{t("You cannot apply: your profile does not match these requirements of the job:")}</p>
                  <RequirementList items={unmet} />
                </div>
              )}
              {!j.applied && unmet.length === 0 && limitReached && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {t("You have reached the maximum number of jobs you can apply to")}
                </p>
              )}
            </div>
          );
        })
      )}
      <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
    </div>
  );
}

export function MyApplications({ refreshKey }: { refreshKey: number }) {
  const { t } = useI18n();
  const [items, setItems] = useState<PortalMyJob[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    apiClient
      .candidateMyJobs()
      .then((r) => {
        if (!live) return;
        setItems(r.items);
        setQuota(r.quota);
        setError(null);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Something went wrong"))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [refreshKey]);

  const tone = (stage: string) =>
    stage === "Rejected" ? "bg-red-100 text-red-700" : stage === "Hired" || stage === "Selected" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700";

  return (
    <div className="space-y-4">
      <QuotaBar quota={quota} />
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{t(error)}</p>}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("You have not applied to any job yet.")}</p>
      ) : (
        items.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4 shadow-sm">
            <div>
              <p className="font-semibold"><JobTitleText title={a.title} ckb={a.titleCkb} /></p>
              <p className="text-xs text-muted-foreground">
                {[a.location, new Date(a.appliedAt).toLocaleDateString()].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="text-end">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone(a.stage)}`}>{t(a.stage)}</span>
              <p className="mt-1 text-xs text-muted-foreground">{t("Pipeline stage")}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
