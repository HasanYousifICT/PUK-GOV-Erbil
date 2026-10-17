"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCandidateFields, useTypeLabels } from "@/components/candidate-fields";
import { ALL_STAGES } from "@/lib/constants";
import { Job } from "@/lib/client";
import { CandidateField, fieldLabel } from "@/lib/candidate-fields";
import { CandidateFilters, CustomFilter, OPS_BY_TYPE, opNeedsValue } from "@/lib/candidate-filters";
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
  jobs,
}: {
  filters: CandidateFilters;
  onChange: (f: CandidateFilters) => void;
  jobs: Job[];
}) {
  const { t, locale } = useI18n();
  const typeLabels = useTypeLabels();
  const { fields } = useCandidateFields();
  const set = (patch: Partial<CandidateFilters>) => onChange({ ...filters, ...patch });
  const custom = filters.custom ?? [];

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
  };

  function updateCustom(i: number, patch: Partial<CustomFilter>) {
    set({ custom: custom.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  }
  function addCustom() {
    const f = fields?.[0];
    if (!f) return;
    set({ custom: [...custom, { fieldId: f.id, op: OPS_BY_TYPE[f.type][0], value: "" }] });
  }
  const fieldOf = (id: string): CandidateField | undefined => fields?.find((f) => f.id === id);

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("Location")}</Label>
          <Input value={filters.location ?? ""} onChange={(e) => set({ location: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("Has all skills (comma-separated)")}</Label>
          <Input value={filters.skills ?? ""} onChange={(e) => set({ skills: e.target.value })} placeholder={t("React, SQL")} />
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
          label={t("Applications")}
          value={filters.applied ?? "any"}
          onChange={(v) => set({ applied: v as CandidateFilters["applied"] })}
          options={[
            { value: "any", label: t("Any") },
            { value: "none", label: t("Not applied to any job") },
            { value: "some", label: t("Applied to at least one job") },
          ]}
        />
        <FilterSelect
          label={t("Job")}
          value={filters.jobId || ANY}
          onChange={(v) => set({ jobId: v === ANY ? undefined : v, jobMode: filters.jobMode ?? "in" })}
          options={[{ value: ANY, label: t("Any") }, ...jobs.map((j) => ({ value: j.id, label: j.title }))]}
        />
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

      {fields && fields.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Profile fields")}</p>
          {custom.map((c, i) => {
            const f = fieldOf(c.fieldId);
            if (!f) return null;
            const ops = OPS_BY_TYPE[f.type];
            return (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <div className="w-44">
                  <Select
                    value={c.fieldId}
                    onValueChange={(id) => {
                      const nf = fieldOf(id);
                      if (nf) updateCustom(i, { fieldId: id, op: OPS_BY_TYPE[nf.type][0], value: "", value2: "" });
                    }}
                  >
                    <SelectTrigger aria-label={t("Field")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {fields.map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {fieldLabel(x, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  (f.type === "select" ? (
                    <div className="w-44">
                      <Select value={c.value || ANY} onValueChange={(v) => updateCustom(i, { value: v === ANY ? "" : v })}>
                        <SelectTrigger aria-label={t("Select an option")}>
                          <SelectValue placeholder={t("Select an option")} />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value={ANY}>{t("Select an option")}</SelectItem>
                          {f.options.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <>
                      <Input
                        className="w-36"
                        dir={f.type === "number" ? "ltr" : "auto"}
                        type={f.type === "number" ? "number" : "text"}
                        step="any"
                        aria-label={t("Value")}
                        value={c.value ?? ""}
                        onChange={(e) => updateCustom(i, { value: e.target.value })}
                      />
                      {c.op === "between" && (
                        <Input
                          className="w-36"
                          dir="ltr"
                          type="number"
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
          <Button variant="outline" size="sm" onClick={addCustom}>
            <Plus className="me-1.5 h-3.5 w-3.5" />
            {t("Add field filter")}
          </Button>
        </div>
      )}
    </div>
  );
}
