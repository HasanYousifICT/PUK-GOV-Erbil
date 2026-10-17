// OpenRecruitOS — custom candidate fields: shared types and helpers (client + server).

import type { Locale } from "@/lib/i18n-core";

export const FIELD_TYPES = ["text", "number", "file", "select"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const MAX_FIELDS = 50;
export const MAX_OPTIONS = 100;

export type CandidateField = {
  id: string;
  label: string;
  labelCkb: string;
  type: FieldType;
  options: string[];
  required: boolean;
  sortOrder: number;
};

export type FileValue = { key: string; name: string };
export type CustomValue = string | number | FileValue;
export type CustomData = Record<string, CustomValue>;

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
  return v === undefined || v === null || v === "";
}

/** Plain-text rendering of a value (files show their name). */
export function displayValue(v: CustomValue | undefined): string {
  if (isEmptyValue(v)) return "";
  if (isFileValue(v)) return v.name;
  return String(v);
}
