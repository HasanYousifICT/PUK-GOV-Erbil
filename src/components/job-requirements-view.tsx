"use client";

import { Badge } from "@/components/ui/badge";
import { useCandidateFields } from "@/components/candidate-fields";
import { STD_FIELDS, isStdField } from "@/lib/candidate-filters";
import { describeRequirement, parseRequirements } from "@/lib/job-requirements";
import { useI18n } from "@/lib/i18n";

/** Read-only list of a job's requirements (no need to open the edit form). */
export function JobRequirementsView({ requirements, note, announced }: { requirements?: string; note?: string; announced?: boolean }) {
  const { t, locale } = useI18n();
  const { fields } = useCandidateFields();
  const rules = parseRequirements(requirements ?? "[]");
  const lines = rules.flatMap((rule) => {
    if (isStdField(rule.fieldId)) {
      const def = STD_FIELDS.find((x) => x.id === rule.fieldId);
      return def ? [describeRequirement({ rule, label: def.label, labelCkb: "", fieldType: "text" }, t, locale)] : [];
    }
    const f = (fields ?? []).find((x) => x.id === rule.fieldId);
    return f ? [describeRequirement({ rule, label: f.label, labelCkb: f.labelCkb, fieldType: f.type }, t, locale)] : [];
  });
  return (
    <>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("Requirements")}</h3>
      {lines.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{t("No requirements set")}</p>
      )}
      {note && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{note}</p>}
      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("Candidate portal")}:</span>
        <Badge variant={announced ? "default" : "secondary"} className="font-normal">
          {announced ? t("Announced") : t("Not announced")}
        </Badge>
      </div>
    </>
  );
}
