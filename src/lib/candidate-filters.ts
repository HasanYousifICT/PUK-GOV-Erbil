// OpenRecruitOS — candidate search filters: shared types and matching logic.

import { CandidateField, CustomData, FieldType, isEmptyValue, isFileValue } from "@/lib/candidate-fields";

export type CustomFilter = {
  fieldId: string;
  op: string;
  value?: string;
  value2?: string;
};

export type CandidateFilters = {
  location?: string;
  skills?: string; // comma-separated, candidate must have all of them
  applied?: "any" | "none" | "some";
  jobId?: string;
  jobMode?: "in" | "notIn";
  stage?: string;
  resume?: "any" | "has" | "none";
  from?: string; // YYYY-MM-DD, date added
  to?: string;
  custom?: CustomFilter[];
};

/** Operators offered for each custom field type (first one is the default). */
export const OPS_BY_TYPE: Record<FieldType, string[]> = {
  text: ["contains", "equals", "notEmpty", "empty"],
  number: ["eq", "gte", "lte", "between", "notEmpty", "empty"],
  select: ["is", "notEmpty", "empty"],
  file: ["notEmpty", "empty"],
};

export function opNeedsValue(op: string): boolean {
  return !["notEmpty", "empty"].includes(op);
}

/** Number of filters currently set (used for the badge on the Filters button). */
export function activeFilterCount(f: CandidateFilters): number {
  let n = 0;
  if (f.location?.trim()) n++;
  if (f.skills?.trim()) n++;
  if (f.applied && f.applied !== "any" && !f.jobId) n++;
  if (f.jobId) n++;
  if (f.stage) n++;
  if (f.resume && f.resume !== "any") n++;
  if (f.from) n++;
  if (f.to) n++;
  n += (f.custom ?? []).filter(isCustomFilterActive).length;
  return n;
}

export function isCustomFilterActive(c: CustomFilter): boolean {
  if (!c.fieldId || !c.op) return false;
  if (!opNeedsValue(c.op)) return true;
  if (c.op === "between") return !!(c.value?.trim() || c.value2?.trim());
  return !!c.value?.trim();
}

/** Does a candidate's custom data satisfy one custom filter? */
export function matchesCustomFilter(data: CustomData, field: CandidateField, f: CustomFilter): boolean {
  const v = data[field.id];
  const empty = isEmptyValue(v);
  if (f.op === "empty") return empty;
  if (f.op === "notEmpty") return !empty;
  if (empty) return false;

  const needle = (f.value ?? "").trim();
  switch (field.type) {
    case "text": {
      const hay = String(v).toLowerCase();
      const n = needle.toLowerCase();
      return f.op === "equals" ? hay === n : hay.includes(n);
    }
    case "select":
      return String(v) === needle;
    case "number": {
      const num = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(num)) return false;
      const a = needle === "" ? NaN : Number(needle);
      const b = (f.value2 ?? "").trim() === "" ? NaN : Number(f.value2);
      switch (f.op) {
        case "eq":
          return num === a;
        case "gte":
          return num >= a;
        case "lte":
          return num <= a;
        case "between":
          return (Number.isNaN(a) || num >= a) && (Number.isNaN(b) || num <= b);
        default:
          return false;
      }
    }
    case "file":
      return isFileValue(v);
    default:
      return false;
  }
}
