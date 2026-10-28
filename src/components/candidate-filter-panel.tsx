"use client";
import { JobPicker } from "@/components/job-picker";
import { CustomFilterRows } from "@/components/custom-filter-rows";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_STAGES } from "@/lib/constants";
import { Job } from "@/lib/client";
import { CandidateFilters } from "@/lib/candidate-filters";
import { useI18n } from "@/lib/i18n";

const ANY = "__any__";

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CandidateFilterPanel({
  filters,
  onChange,
}: {
  filters: CandidateFilters;
  onChange: (f: CandidateFilters) => void;
}) {
  const { t } = useI18n();
  const set = (patch: Partial<CandidateFilters>) => onChange({ ...filters, ...patch });
  const custom = filters.custom ?? [];

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("Location")}</Label>
          <Input value={filters.location ?? ""} onChange={(e) => set({ location: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("Added from")}</Label>
          <Input type="date" dir="ltr" value={filters.from ?? ""} onChange={(e) => set({ from: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("Added until")}</Label>
          <Input type="date" dir="ltr" value={filters.to ?? ""} onChange={(e) => set({ to: e.target.value })} />
        </div>

        <FilterSelect
          label={t("Resume")}
          value={filters.resume ?? "any"}
          onChange={(v) => set({ resume: v as CandidateFilters["resume"] })}
          options={[
            { value: "any", label: t("Any") },
            { value: "has", label: t("Has resume") },
            { value: "none", label: t("No resume") },
          ]}
        />
        <FilterSelect
          label={t("Profile access (login)")}
          value={filters.access ?? "any"}
          onChange={(v) => set({ access: v as CandidateFilters["access"] })}
          options={[
            { value: "any", label: t("Any") },
            { value: "has", label: t("Has a login (can open their profile)") },
            { value: "none", label: t("No login yet (no username / password)") },
          ]}
        />
        <FilterSelect
          label={t("Applications")}
          value={filters.applied ?? "any"}
          onChange={(v) => set({ applied: v as CandidateFilters["applied"] })}
          options={[
            { value: "any", label: t("Any") },
            { value: "none", label: t("Not applied to any job") },
            { value: "some", label: t("Applied to at least one job") },
          ]}
        />
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("Job")}</Label>
          <JobPicker compact value={filters.jobId ?? ""} onChange={(id) => set({ jobId: id || undefined, jobMode: filters.jobMode ?? "in" })} />
        </div>
        {filters.jobId ? (
          <FilterSelect
            label={t("Job condition")}
            value={filters.jobMode ?? "in"}
            onChange={(v) => set({ jobMode: v as "in" | "notIn" })}
            options={[
              { value: "in", label: t("Applied to this job") },
              { value: "notIn", label: t("Not applied to this job") },
            ]}
          />
        ) : (
          <div />
        )}
        {filters.jobId && (filters.jobMode ?? "in") === "in" && (
          <FilterSelect
            label={t("Stage in that job")}
            value={filters.stage || ANY}
            onChange={(v) => set({ stage: v === ANY ? undefined : v })}
            options={[{ value: ANY, label: t("Any") }, ...ALL_STAGES.map((s) => ({ value: s, label: t(s) }))]}
          />
        )}
      </div>

      <div className="border-t pt-3">
        <CustomFilterRows value={custom} onChange={(v) => set({ custom: v })} />
      </div>
    </div>
  );
}
