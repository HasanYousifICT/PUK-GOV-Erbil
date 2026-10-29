"use client";

import { useEffect, useState } from "react";
import { CategoryFilter, useCategories } from "@/components/category-picker";
import { useJobTitles } from "@/components/job-titles";
import { useJobTitle } from "@/components/job-title-text";
import { SearchableSelect } from "@/components/searchable-select";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient, JobLite } from "@/lib/client";
import { useI18n } from "@/lib/i18n";

export type JobFilterState = {
  categoryId: string | null;
  title: string;
  specialist: "any" | "yes" | "no";
  note: string;
  jobStatus: "any" | "Open" | "Closed";
  jobId: string;
};
export const EMPTY_JOB_FILTER: JobFilterState = { categoryId: null, title: "", specialist: "any", note: "", jobStatus: "any", jobId: "" };
export const jobFilterActive = (f: JobFilterState) =>
  !!(f.categoryId || f.title || f.specialist !== "any" || f.jobStatus !== "any" || f.jobId);

/** Query parameters for the server. */
export function jobFilterParams(f: JobFilterState) {
  return {
    categoryId: f.categoryId ?? undefined,
    title: f.title || undefined,
    specialist: f.specialist === "any" ? undefined : f.specialist,
    specialistNote: f.specialist === "yes" ? f.note || undefined : undefined,
    jobStatus: f.jobStatus === "any" ? undefined : f.jobStatus,
    jobId: f.jobId || undefined,
  };
}

/** Classification, job title, specialist, job status and a job dropdown that only lists matching jobs. */
export function JobFilterFields({ value: f, onChange }: { value: JobFilterState; onChange: (v: JobFilterState) => void }) {
  const { t, locale } = useI18n();
  const { index } = useCategories();
  const { list: titleList } = useJobTitles();
  const jobTitle = useJobTitle();
  const [notes, setNotes] = useState<string[]>([]);
  const [jobs, setJobs] = useState<JobLite[]>([]);
  const set = (patch: Partial<JobFilterState>) => onChange({ ...f, ...patch, ...("jobId" in patch ? {} : { jobId: "" }) });

  useEffect(() => {
    if (f.specialist === "yes") apiClient.jobSpecialists().then(setNotes).catch(() => setNotes([]));
  }, [f.specialist]);
  useEffect(() => {
    let live = true;
    apiClient
      .searchJobs({
        categoryId: f.categoryId ?? undefined,
        title: f.title || undefined,
        specialist: f.specialist === "any" ? undefined : f.specialist,
        specialistNote: f.specialist === "yes" ? f.note || undefined : undefined,
        status: f.jobStatus === "any" ? undefined : f.jobStatus,
        limit: 100,
      })
      .then((r) => live && setJobs(r))
      .catch(() => live && setJobs([]));
    return () => {
      live = false;
    };
  }, [f.categoryId, f.title, f.specialist, f.note, f.jobStatus]);

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("Classification")}</Label>
        <CategoryFilter value={f.categoryId} onChange={(id) => set({ categoryId: id })} index={index} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("Job title")}</Label>
        <SearchableSelect
          value={f.title || undefined}
          ariaLabel={t("Job title")}
          noneLabel={t("All job titles")}
          options={(titleList ?? []).map((r) => ({ value: r.title, label: locale === "ckb" && r.titleCkb ? r.titleCkb : r.title }))}
          onChange={(v) => set({ title: v ?? "" })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("Specialist")}</Label>
        <Select value={f.specialist} onValueChange={(v) => set({ specialist: v as JobFilterState["specialist"], note: "" })}>
          <SelectTrigger aria-label={t("Specialist")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("Any")}</SelectItem>
            <SelectItem value="yes">{t("Has a specialist")}</SelectItem>
            <SelectItem value="no">{t("No specialist")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {f.specialist === "yes" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("Specialist description")}</Label>
          <SearchableSelect
            value={f.note || undefined}
            ariaLabel={t("Specialist description")}
            noneLabel={t("All specialists")}
            options={notes.map((n) => ({ value: n, label: n }))}
            onChange={(v) => set({ note: v ?? "" })}
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("Job status")}</Label>
        <Select value={f.jobStatus} onValueChange={(v) => set({ jobStatus: v as JobFilterState["jobStatus"] })}>
          <SelectTrigger aria-label={t("Job status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("Any")}</SelectItem>
            <SelectItem value="Open">{t("Open")}</SelectItem>
            <SelectItem value="Closed">{t("Closed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs text-muted-foreground">{t("Job")}</Label>
        <SearchableSelect
          value={f.jobId || undefined}
          ariaLabel={t("Job")}
          noneLabel={t("All jobs")}
          options={jobs.map((j) => ({
            value: j.id,
            label: [jobTitle(j.title), j.specialist && j.specialistNote ? `(${j.specialistNote})` : "", j.location].filter(Boolean).join(" · "),
          }))}
          onChange={(v) => set({ jobId: v ?? "" })}
        />
      </div>
    </>
  );
}
