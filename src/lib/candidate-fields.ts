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

/** Show a field only when another field matches. */
export const SHOW_OPS = ["equals", "notEquals", "filled"] as const;
export type ShowOp = (typeof SHOW_OPS)[number];
export type ShowIf = { fieldId: string; op: ShowOp; value: string };

export function parseShowIf(raw: string | null | undefined): ShowIf | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v.fieldId === "string" && (SHOW_OPS as readonly string[]).includes(v.op)) {
      return { fieldId: v.fieldId, op: v.op, value: typeof v.value === "string" ? v.value : "" };
    }
  } catch {
    /* ignore */
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
  showIf: ShowIf | null;
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
 * Whether a field is shown for the given answers. A field whose controlling field
 * is itself hidden is hidden too (chains work; loops count as hidden).
 */
export function isFieldVisible(
  field: CandidateField,
  data: CustomData,
  fields: CandidateField[],
  seen: string[] = []
): boolean {
  const cond = field.showIf;
  if (!cond) return true;
  if (seen.includes(field.id)) return false;
  const parent = fields.find((f) => f.id === cond.fieldId);
  if (!parent) return true; // controlling field was deleted — treat as always shown
  if (!isFieldVisible(parent, data, fields, [...seen, field.id])) return false;
  return matchesCondition(cond, data[parent.id]);
}
