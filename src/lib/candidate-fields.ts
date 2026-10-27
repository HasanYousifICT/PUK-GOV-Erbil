// OpenRecruitOS — custom candidate fields: shared types and helpers (client + server).

import type { Locale } from "@/lib/i18n-core";

export const FIELD_TYPES = [
  "text",
  "longtext",
  "number",
  "date",
  "email",
  "phone",
  "url",
  "yesno",
  "select",
  "multiselect",
  "file",
  "table",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Types whose value is picked from a list of options. */
export function hasOptions(type: FieldType): boolean {
  return type === "select" || type === "multiselect";
}

/** Types that keep a list in `options`: choices for dropdowns, column names for tables. */
export function hasList(type: FieldType): boolean {
  return hasOptions(type) || type === "table";
}

/** Types stored and searched as plain text. */
export function isTextType(type: FieldType): boolean {
  return type === "text" || type === "longtext" || type === "email" || type === "phone" || type === "url";
}

export const MAX_FIELDS = 150;
export const MAX_TABLE_COLUMNS = 8;
export const MAX_TABLE_ROWS = 30;
export const MAX_OPTIONS = 100;

/** Show a field only when other fields match. */
export const SHOW_OPS = ["equals", "notEquals", "filled"] as const;
export type ShowOp = (typeof SHOW_OPS)[number];
export type ShowIf = { fieldId: string; op: ShowOp; value: string };
/** One or more conditions: all of them (AND) or any of them (OR). */
export type ShowRule = { match: "all" | "any"; conds: ShowIf[] };
export const MAX_CONDITIONS = 10;

function cleanCond(v: unknown): ShowIf | null {
  const o = v as Record<string, unknown> | null;
  if (o && typeof o.fieldId === "string" && (SHOW_OPS as readonly string[]).includes(o.op as string)) {
    return { fieldId: o.fieldId, op: o.op as ShowOp, value: typeof o.value === "string" ? o.value : "" };
  }
  return null;
}

/** Reads the stored condition(s); an older single `{fieldId, op, value}` becomes a rule with one condition. */
export function parseShowIf(raw: string | null | undefined): ShowRule | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && Array.isArray(v.conds)) {
      const conds = (v.conds as unknown[]).map(cleanCond).filter((c): c is ShowIf => !!c).slice(0, MAX_CONDITIONS);
      return conds.length ? { match: v.match === "any" ? "any" : "all", conds } : null;
    }
    const one = cleanCond(v);
    return one ? { match: "all", conds: [one] } : null;
  } catch {
    /* ignore */
  }
  return null;
}

/** Per-field options beyond the type. */
export type FieldSettings = {
  /** number field: calculated as the age from this date field (never typed, never required) */
  ageFrom?: string;
  /** text / dropdown field: its answer is copied into the candidate's Location */
  toLocation?: boolean;
  /** table field: only one row can be added */
  singleRow?: boolean;
};

export function parseFieldSettings(raw: string | null | undefined): FieldSettings {
  try {
    const v = JSON.parse(raw || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: FieldSettings = {};
    if (typeof v.ageFrom === "string" && v.ageFrom) out.ageFrom = v.ageFrom;
    if (v.toLocation === true) out.toLocation = true;
    if (v.singleRow === true) out.singleRow = true;
    return out;
  } catch {
    return {};
  }
}

/** Years, months and days between a birth date (YYYY-MM-DD) and today; null when the date is missing or in the future. */
export function ageParts(dob: unknown, now: Date = new Date()): { years: number; months: number; days: number } | null {
  if (typeof dob !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [by, bm, bd] = dob.split("-").map(Number);
  let years = now.getFullYear() - by;
  let months = now.getMonth() + 1 - bm;
  let days = now.getDate() - bd;
  if (days < 0) {
    months--;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); // length of the previous month
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years < 0 || Number.isNaN(years)) return null;
  return { years, months, days };
}

/** "28 years, 3 months, 12 days" (translated through `t`). */
export function formatAge(a: { years: number; months: number; days: number }, t: (s: string, v?: Record<string, string | number>) => string): string {
  return [
    t(a.years === 1 ? "{n} year" : "{n} years", { n: a.years }),
    t(a.months === 1 ? "{n} month" : "{n} months", { n: a.months }),
    t(a.days === 1 ? "{n} day" : "{n} days", { n: a.days }),
  ].join(", ");
}

/** Answers with every calculated age field filled in from today's date (as a formatted text when `t` is given, else whole years). */
export function withCalculated(
  fields: { id: string; settings: FieldSettings }[],
  data: CustomData,
  t?: (s: string, v?: Record<string, string | number>) => string
): CustomData {
  let out = data;
  for (const f of fields) {
    if (!f.settings.ageFrom) continue;
    const a = ageParts(data[f.settings.ageFrom]);
    if (out === data) out = { ...data };
    if (a) out[f.id] = t ? formatAge(a, t) : a.years;
    else delete out[f.id];
  }
  return out;
}

/** What goes into the candidate's Location: the answer of the field marked "use as location". */
export function locationFromAnswers(fields: { id: string; settings: FieldSettings }[], data: CustomData): string {
  for (const f of fields) {
    if (!f.settings.toLocation) continue;
    const v = data[f.id];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 200);
  }
  return "";
}

/** Column kinds for table fields (each column has its own type). */
export const COLUMN_TYPES = ["text", "number", "date", "email", "phone", "yesno", "select"] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];
export type ColumnDef = { type: ColumnType; required: boolean; options: string[] };
export const MAX_COLUMN_OPTIONS = 50;

export function parseColumnDefs(raw: string | null | undefined, count: number): ColumnDef[] {
  let list: unknown[] = [];
  try {
    const v = JSON.parse(raw || "[]");
    if (Array.isArray(v)) list = v;
  } catch {
    /* ignore */
  }
  return Array.from({ length: count }, (_, i) => {
    const o = (list[i] ?? {}) as Record<string, unknown>;
    const type = (COLUMN_TYPES as readonly string[]).includes(o.type as string) ? (o.type as ColumnType) : "text";
    return {
      type,
      required: o.required === true,
      options: type === "select" && Array.isArray(o.options) ? o.options.filter((x): x is string => typeof x === "string") : [],
    };
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Is one table cell acceptable for its column type? (An empty cell is checked separately.) */
export function cellProblem(def: ColumnDef, v: string): boolean {
  if (!v) return false;
  switch (def.type) {
    case "number":
      return !Number.isFinite(Number(v));
    case "date":
      return !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(`${v}T00:00:00.000Z`).getTime());
    case "email":
      return !EMAIL_RE.test(v);
    case "phone":
      return !/^[+\d][\d\s()-]{4,29}$/.test(v);
    case "yesno":
      return v !== "yes" && v !== "no";
    case "select":
      return !def.options.includes(v);
    default:
      return false;
  }
}

/**
 * The first problem in a table answer (a required column left empty, a wrong value), or null.
 * Rows that are completely empty are ignored. Shared by the forms and the server.
 */
export function tableProblem(field: { options: string[]; columns: ColumnDef[] }, rows: string[][]): { kind: "required" | "invalid"; column: string } | null {
  for (const row of rows) {
    if (!row.some((c) => (c ?? "").trim())) continue;
    for (let i = 0; i < field.options.length; i++) {
      const def = field.columns[i] ?? { type: "text", required: false, options: [] };
      const v = (row[i] ?? "").trim();
      if (!v && def.required) return { kind: "required", column: field.options[i] };
      if (v && cellProblem(def, v)) return { kind: "invalid", column: field.options[i] };
    }
  }
  return null;
}

export type CandidateField = {
  id: string;
  label: string;
  labelCkb: string;
  type: FieldType;
  options: string[];
  required: boolean;
  publicForm: boolean;
  sectionId: string;
  showIf: ShowRule | null;
  /** tables: type / required per column (same order as `options`, which holds the column names) */
  columns: ColumnDef[];
  settings: FieldSettings;
  sortOrder: number;
};

export type CandidateSection = {
  id: string;
  name: string;
  nameCkb: string;
  sortOrder: number;
};

export const MAX_SECTIONS = 30;

export function sectionLabel(s: CandidateSection, locale: Locale): string {
  return locale === "ckb" && s.nameCkb ? s.nameCkb : s.name;
}

/** The section that holds the built-in fields (name, email, phone…): "Personal information". */
export function isPersonalSection(s: CandidateSection): boolean {
  return s.name.trim().toLowerCase() === "personal information" || s.nameCkb.trim() === "زانیاری کەسی";
}

/** Built-in candidate fields; they live in "Personal information" and cannot be deleted. */
export const BUILTIN_FIELDS = [
  { key: "name", label: "Full Name", icon: "user", required: true },
  { key: "email", label: "Email", icon: "mail", required: true },
  { key: "phone", label: "Phone", icon: "phone", required: true },
  { key: "location", label: "Location", icon: "text", required: false },
] as const;

/** Group fields by section (section order, then field order). Empty sections are left out unless includeEmpty. */
export function groupFields(
  fields: CandidateField[],
  sections: CandidateSection[],
  includeEmpty = false
): { section: CandidateSection; fields: CandidateField[] }[] {
  if (sections.length === 0) return [];
  const ids = new Set(sections.map((s) => s.id));
  return sections
    .map((section, i) => ({
      section,
      fields: fields.filter((f) => (ids.has(f.sectionId) ? f.sectionId === section.id : i === 0)),
    }))
    .filter((g) => includeEmpty || g.fields.length > 0);
}

export type FileValue = { key: string; name: string };
/** A repeating table: one string[] per row, one cell per column (the field's `options`). */
export type TableValue = { rows: string[][] };
export type CustomValue = string | number | string[] | FileValue | TableValue;
export type CustomData = Record<string, CustomValue>;

export function isTableValue(v: unknown): v is TableValue {
  return !!v && typeof v === "object" && Array.isArray((v as TableValue).rows);
}

export function isFileValue(v: unknown): v is FileValue {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as FileValue).key === "string" &&
    (v as FileValue).key.length > 0 &&
    typeof (v as FileValue).name === "string"
  );
}

/** Parse the JSON stored in Candidate.customData (never throws). */
export function parseCustomData(raw: string | null | undefined): CustomData {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as CustomData) : {};
  } catch {
    return {};
  }
}

export function parseOptions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function fieldLabel(f: CandidateField, locale: Locale): string {
  return locale === "ckb" && f.labelCkb ? f.labelCkb : f.label;
}

export function isEmptyValue(v: CustomValue | undefined): boolean {
  return (
    v === undefined ||
    v === null ||
    v === "" ||
    (Array.isArray(v) && v.length === 0) ||
    (isTableValue(v) && v.rows.length === 0)
  );
}

/** Plain-text rendering of a value (files show their name). */
export function displayValue(v: CustomValue | undefined): string {
  if (isEmptyValue(v)) return "";
  if (isFileValue(v)) return v.name;
  if (isTableValue(v)) return v.rows.map((r) => r.filter(Boolean).join(" / ")).join("; ");
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function matchesCondition(cond: ShowIf, v: CustomValue | undefined): boolean {
  if (cond.op === "filled") return !isEmptyValue(v);
  const has = Array.isArray(v) ? v.includes(cond.value) : !isEmptyValue(v) && displayValue(v) === cond.value;
  return cond.op === "equals" ? has : !has;
}

/**
 * Whether a field is shown for the given answers. With several conditions, "all" needs every one
 * to match and "any" needs one. A condition whose controlling field is itself hidden counts as not
 * matched (chains work; loops count as hidden). Conditions on deleted fields are ignored.
 */
export function isFieldVisible(
  field: CandidateField,
  data: CustomData,
  fields: CandidateField[],
  seen: string[] = []
): boolean {
  const rule = field.showIf;
  if (!rule || rule.conds.length === 0) return true;
  if (seen.includes(field.id)) return false;
  const results: boolean[] = [];
  for (const cond of rule.conds) {
    const parent = fields.find((f) => f.id === cond.fieldId);
    if (!parent) continue; // controlling field was deleted
    results.push(isFieldVisible(parent, data, fields, [...seen, field.id]) && matchesCondition(cond, data[parent.id]));
  }
  if (results.length === 0) return true;
  return rule.match === "any" ? results.some(Boolean) : results.every(Boolean);
}
