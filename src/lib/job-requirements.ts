// Job requirements: rules checked against a candidate's profile (shared by the server and the screens).

import { CandidateField, CustomData, withCalculated } from "@/lib/candidate-fields";
import { CustomFilter, isCustomFilterActive, isStdField, matchesCustomFilter, matchesStdFilter, opNeedsValue, STD_FIELDS } from "@/lib/candidate-filters";

export const MAX_REQUIREMENTS = 20;

/** Read the JSON stored in Job.requirements into clean rules (never throws). */
export function parseRequirements(raw: unknown): CustomFilter[] {
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw || "[]");
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return [];
  const out: CustomFilter[] = [];
  for (const r of list.slice(0, MAX_REQUIREMENTS)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const rule: CustomFilter = {
      fieldId: typeof o.fieldId === "string" ? o.fieldId : "",
      op: typeof o.op === "string" ? o.op : "",
      value: typeof o.value === "string" ? o.value.slice(0, 200) : undefined,
      value2: typeof o.value2 === "string" ? o.value2.slice(0, 200) : undefined,
    };
    if (isCustomFilterActive(rule)) out.push(rule);
  }
  return out;
}

export type RequirementResult = {
  rule: CustomFilter;
  met: boolean;
  /** name of the field (English / Kurdish) so the screen can describe the rule even for fields that are not on the public form */
  label: string;
  labelCkb: string;
  /** options of a dropdown field are shown as they are; yes/no are translated by the screen */
  fieldType: string;
};

/**
 * Check every rule against the candidate (built-in columns + custom answers). Ages are recalculated from
 * today's date. A rule on a field that no longer exists is ignored.
 */
export function evaluateRequirements(
  rules: CustomFilter[],
  candidate: Record<string, unknown>,
  customData: CustomData,
  fields: CandidateField[]
): RequirementResult[] {
  const data = withCalculated(fields, customData);
  const out: RequirementResult[] = [];
  for (const rule of rules) {
    if (isStdField(rule.fieldId)) {
      const def = STD_FIELDS.find((x) => x.id === rule.fieldId);
      if (!def) continue;
      out.push({ rule, met: matchesStdFilter(candidate, rule), label: def.label, labelCkb: "", fieldType: "text" });
      continue;
    }
    const f = fields.find((x) => x.id === rule.fieldId);
    if (!f) continue;
    out.push({ rule, met: matchesCustomFilter(data, f, rule), label: f.label, labelCkb: f.labelCkb, fieldType: f.type });
  }
  return out;
}

type T = (s: string, v?: Record<string, string | number>) => string;

/** "Age (years) at least 25" — one rule as a sentence (translated through `t`). */
export function describeRequirement(r: Pick<RequirementResult, "rule" | "label" | "labelCkb" | "fieldType">, t: T, locale: string): string {
  const ops: Record<string, string> = {
    contains: t("contains"),
    equals: t("equals"),
    notEmpty: t("is filled"),
    empty: t("is empty"),
    eq: t("="),
    gte: t("at least"),
    lte: t("at most"),
    between: t("between"),
    is: t("is"),
    on: t("on"),
    after: t("on or after"),
    before: t("on or before"),
    includes: t("includes"),
  };
  const name = locale === "ckb" && r.labelCkb ? r.labelCkb : t(r.label);
  const show = (v?: string) => (v === "yes" ? t("Yes") : v === "no" ? t("No") : (v ?? ""));
  const op = ops[r.rule.op] ?? r.rule.op;
  if (!opNeedsValue(r.rule.op)) return `${name} ${op}`;
  if (r.rule.op === "between") return `${name} ${op} ${show(r.rule.value)} – ${show(r.rule.value2)}`;
  return `${name} ${op} ${show(r.rule.value)}`;
}
