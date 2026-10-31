// OpenRecruitOS — candidate search filters: shared types and matching logic.

import { CandidateField, CustomData, FieldType, isEmptyValue, isFileValue, isTableValue } from "@/lib/candidate-fields";

export type CustomFilter = {
  fieldId: string;
  op: string;
  value?: string;
  value2?: string;
  /** the chosen options of a "any of / none of / includes any / includes all" condition */
  values?: string[];
};

/** Operators that take a list of values instead of one value. */
export const LIST_OPS = ["anyOf", "noneOf", "includesAny", "includesAll", "containsAny"];
export function isListOp(op: string): boolean {
  return LIST_OPS.includes(op);
}

export const MAX_LIST_VALUES = 50;

/** Clean a list of values coming from the client (strings only, trimmed, no duplicates, no empties). */
export function cleanValues(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const v = x.trim().slice(0, 200);
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= MAX_LIST_VALUES) break;
  }
  return out.length ? out : undefined;
}

/** The values of a condition: the list when it has one, otherwise the single value. */
export function valuesOf(f: CustomFilter): string[] {
  if (f.values && f.values.length) return f.values;
  const v = (f.value ?? "").trim();
  return v ? [v] : [];
}

type Tr = (s: string) => string;
/** Names of all operators in the current language (shared by the filter screens and the requirement sentences). */
export function opLabels(t: Tr): Record<string, string> {
  return {
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
    anyOf: t("is any of"),
    noneOf: t("is none of"),
    includesAny: t("includes any of"),
    includesAll: t("includes all of"),
    containsAny: t("contains any of"),
  };
}

export type CandidateFilters = {
  location?: string;
  skills?: string; // comma-separated, candidate must have all of them
  applied?: "any" | "none" | "some";
  jobId?: string;
  jobMode?: "in" | "notIn";
  stage?: string;
  resume?: "any" | "has" | "none";
  access?: "any" | "has" | "none"; // does the candidate have a login (username/phone + password)?
  from?: string; // YYYY-MM-DD, date added
  to?: string;
  custom?: CustomFilter[];
};

/** Operators offered for each custom field type (first one is the default). */
export const OPS_BY_TYPE: Record<FieldType, string[]> = {
  text: ["contains", "equals", "anyOf", "containsAny", "notEmpty", "empty"],
  longtext: ["contains", "containsAny", "notEmpty", "empty"],
  email: ["contains", "equals", "notEmpty", "empty"],
  phone: ["contains", "equals", "notEmpty", "empty"],
  url: ["contains", "notEmpty", "empty"],
  number: ["eq", "gte", "lte", "between", "notEmpty", "empty"],
  date: ["on", "after", "before", "between", "notEmpty", "empty"],
  yesno: ["is", "notEmpty", "empty"],
  select: ["is", "anyOf", "noneOf", "notEmpty", "empty"],
  multiselect: ["includes", "includesAny", "includesAll", "notEmpty", "empty"],
  file: ["notEmpty", "empty"],
  table: ["contains", "notEmpty", "empty"],
};

/** Built-in candidate fields that can be filtered too (ids start with "std:"). */
export const STD_FIELDS = [
  { id: "std:name", key: "name", label: "Full name" },
  { id: "std:code", key: "code", label: "Candidate code" },
  { id: "std:email", key: "email", label: "Email" },
  { id: "std:phone", key: "phone", label: "Phone" },
  { id: "std:location", key: "location", label: "Location" },
  { id: "std:tags", key: "tags", label: "Tags" },
  { id: "std:notes", key: "notes", label: "Notes" },
] as const;

export const STD_OPS = ["contains", "equals", "anyOf", "containsAny", "notEmpty", "empty"];

export function isStdField(id: string): boolean {
  return id.startsWith("std:");
}

/** Does a candidate satisfy a filter on one of the built-in fields? */
export function matchesStdFilter(c: Record<string, unknown>, f: CustomFilter): boolean {
  const def = STD_FIELDS.find((x) => x.id === f.fieldId);
  if (!def) return true;
  const raw = c[def.key];
  const hay = (typeof raw === "string" ? raw : "").trim().toLowerCase();
  if (f.op === "empty") return hay === "";
  if (f.op === "notEmpty") return hay !== "";
  if (isListOp(f.op)) {
    const list = valuesOf(f).map((x) => x.toLowerCase());
    return f.op === "anyOf" ? list.includes(hay) : list.some((x) => hay.includes(x));
  }
  const needle = (f.value ?? "").trim().toLowerCase();
  return f.op === "equals" ? hay === needle : hay.includes(needle);
}

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
  if (f.access && f.access !== "any") n++;
  if (f.from) n++;
  if (f.to) n++;
  n += (f.custom ?? []).filter(isCustomFilterActive).length;
  return n;
}

export function isCustomFilterActive(c: CustomFilter): boolean {
  if (!c.fieldId || !c.op) return false;
  if (!opNeedsValue(c.op)) return true;
  if (isListOp(c.op)) return valuesOf(c).length > 0;
  if (c.op === "between") return !!(c.value?.trim() || c.value2?.trim());
  return !!c.value?.trim();
}

/** Does a candidate's custom data satisfy one custom filter? */
export function matchesCustomFilter(data: CustomData, field: CandidateField, f: CustomFilter): boolean {
  const v = data[field.id];
  const empty = isEmptyValue(v);
  if (f.op === "empty") return empty;
  if (f.op === "notEmpty") return !empty;
  // "is none of": a candidate who gave no answer has none of the excluded options
  if (f.op === "noneOf" && empty) return true;
  if (empty) return false;

  const needle = (f.value ?? "").trim();
  if (isListOp(f.op)) {
    const list = valuesOf(f);
    switch (field.type) {
      case "select":
      case "yesno":
        return f.op === "noneOf" ? !list.includes(String(v)) : list.includes(String(v));
      case "multiselect": {
        const have = Array.isArray(v) ? v.map(String) : [];
        return f.op === "includesAll" ? list.every((x) => have.includes(x)) : list.some((x) => have.includes(x));
      }
      case "text":
      case "longtext":
      case "email":
      case "phone":
      case "url": {
        const hay = String(v).toLowerCase();
        const l = list.map((x) => x.toLowerCase());
        return f.op === "anyOf" ? l.includes(hay) : l.some((x) => hay.includes(x));
      }
      default:
        return false;
    }
  }
  switch (field.type) {
    case "text":
    case "longtext":
    case "email":
    case "phone":
    case "url": {
      const hay = String(v).toLowerCase();
      const n = needle.toLowerCase();
      return f.op === "equals" ? hay === n : hay.includes(n);
    }
    case "select":
    case "yesno":
      return String(v) === needle;
    case "multiselect":
      return Array.isArray(v) && v.includes(needle);
    case "date": {
      const d = String(v);
      const to = (f.value2 ?? "").trim();
      switch (f.op) {
        case "on":
          return d === needle;
        case "after":
          return d >= needle;
        case "before":
          return d <= needle;
        case "between":
          return (!needle || d >= needle) && (!to || d <= to);
        default:
          return false;
      }
    }
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
    case "table":
      return isTableValue(v) && v.rows.some((r) => r.some((cell) => cell.toLowerCase().includes(needle.toLowerCase())));
    case "file":
      return isFileValue(v);
    default:
      return false;
  }
}
