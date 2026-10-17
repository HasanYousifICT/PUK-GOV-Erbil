// Server-only: validation and clean-up for custom candidate field values.

import { ApiError } from "@/lib/api";
import {
  CandidateField,
  CustomData,
  CustomValue,
  FieldType,
  FIELD_TYPES,
  isFileValue,
  MAX_OPTIONS,
  parseCustomData,
  parseOptions,
} from "@/lib/candidate-fields";
import { getStorage } from "@/lib/storage";
import { db } from "@/lib/db";

type FieldRow = {
  id: string;
  label: string;
  labelCkb: string;
  type: string;
  options: string;
  required: boolean;
  sortOrder: number;
};

export function serializeField(row: FieldRow): CandidateField {
  return {
    id: row.id,
    label: row.label,
    labelCkb: row.labelCkb,
    type: (FIELD_TYPES as readonly string[]).includes(row.type) ? (row.type as FieldType) : "text",
    options: parseOptions(row.options),
    required: row.required,
    sortOrder: row.sortOrder,
  };
}

export async function loadFields(): Promise<CandidateField[]> {
  const rows = await db.candidateField.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows.map(serializeField);
}

/** Trim, drop blanks and duplicates; enforce size limits. */
export function normalizeOptions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const v = item.trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    if (v.length > 100) throw new ApiError(400, "Option is too long (max 100 characters)");
    seen.add(v.toLowerCase());
    out.push(v);
  }
  if (out.length > MAX_OPTIONS) throw new ApiError(400, "Too many options (max 100)");
  return out;
}

/**
 * Validate the `customData` object sent by the client against the current field
 * definitions. Unknown keys are dropped. Returns the clean map plus the storage
 * keys of attachments that are no longer referenced (to delete after saving).
 */
export function validateCustomData(
  input: unknown,
  fields: CandidateField[],
  existing: CustomData = {}
): { data: CustomData; removedFiles: string[] } {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(400, "Invalid custom field data");
  }
  const src = input as Record<string, unknown>;
  const data: CustomData = {};

  for (const f of fields) {
    const raw = src[f.id];
    let value: CustomValue | undefined;

    if (raw !== undefined && raw !== null && raw !== "") {
      switch (f.type) {
        case "text": {
          if (typeof raw !== "string") throw new ApiError(400, "Invalid text value");
          value = raw.trim().slice(0, 2000) || undefined;
          break;
        }
        case "number": {
          const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
          if (!Number.isFinite(n)) throw new ApiError(400, "Invalid number value");
          value = n;
          break;
        }
        case "select": {
          if (typeof raw !== "string" || !f.options.includes(raw)) throw new ApiError(400, "Invalid dropdown option");
          value = raw;
          break;
        }
        case "file": {
          if (!isFileValue(raw) || !raw.key.startsWith("attachments/") || raw.key.includes("..")) {
            throw new ApiError(400, "Invalid attachment");
          }
          value = { key: raw.key, name: raw.name.slice(0, 200) };
          break;
        }
      }
    }

    if (value === undefined) {
      if (f.required) throw new ApiError(400, "A required custom field is missing");
    } else {
      data[f.id] = value;
    }
  }

  const removedFiles: string[] = [];
  for (const f of fields) {
    if (f.type !== "file") continue;
    const before = existing[f.id];
    const after = data[f.id];
    if (isFileValue(before) && (!isFileValue(after) || after.key !== before.key)) removedFiles.push(before.key);
  }
  return { data, removedFiles };
}

/** Delete stored attachments, ignoring failures. */
export async function deleteFiles(keys: string[]) {
  const storage = getStorage();
  await Promise.all(keys.map((k) => storage.delete(k).catch(() => undefined)));
}

/** Storage keys of every attachment inside a candidate's custom data. */
export function fileKeysOf(raw: string | null | undefined): string[] {
  return Object.values(parseCustomData(raw))
    .filter(isFileValue)
    .map((v) => v.key);
}
