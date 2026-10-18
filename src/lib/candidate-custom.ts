// Server-only: validation and clean-up for custom candidate field values.

import { ApiError } from "@/lib/api";
import {
  CandidateField,
  CandidateSection,
  CustomData,
  CustomValue,
  FieldType,
  FIELD_TYPES,
  isFileValue,
  isTableValue,
  MAX_OPTIONS,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  hasOptions,
  isFieldVisible,
  SHOW_OPS,
  parseCustomData,
  parseOptions,
  parseShowIf,
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
  publicForm: boolean;
  sectionId: string;
  showIf: string;
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
    publicForm: row.publicForm,
    sectionId: row.sectionId,
    showIf: parseShowIf(row.showIf),
    sortOrder: row.sortOrder,
  };
}

export const DEFAULT_SECTIONS: [string, string][] = [
  ["Summary of information", "پوختەی زانیاری"],
  ["Experience", "ئەزموون"],
  ["Education", "خوێندن"],
  ["Skills", "لێهاتووییەکان"],
  ["Additional information", "زانیاری زیاتر"],
];

/** All sections in display order. Creates the default ones the first time. */
export async function loadSections(): Promise<CandidateSection[]> {
  let rows = await db.candidateSection.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  if (rows.length === 0) {
    await db.candidateSection.createMany({
      data: DEFAULT_SECTIONS.map(([name, nameCkb], i) => ({ name, nameCkb, sortOrder: i })),
    });
    rows = await db.candidateSection.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  }
  return rows.map((r) => ({ id: r.id, name: r.name, nameCkb: r.nameCkb, sortOrder: r.sortOrder }));
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
  existing: CustomData = {},
  opts: { enforceRequired?: boolean } = {}
): { data: CustomData; removedFiles: string[] } {
  const enforceRequired = opts.enforceRequired !== false;
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(400, "Invalid custom field data");
  }
  const src = input as Record<string, unknown>;
  const data: CustomData = {};
  const missing = new Set<string>();

  for (const f of fields) {
    const raw = src[f.id];
    let value: CustomValue | undefined;

    if (raw !== undefined && raw !== null && raw !== "") {
      switch (f.type) {
        case "text":
        case "longtext": {
          if (typeof raw !== "string") throw new ApiError(400, "Invalid text value");
          value = raw.trim().slice(0, f.type === "longtext" ? 5000 : 2000) || undefined;
          break;
        }
        case "email": {
          const v = typeof raw === "string" ? raw.trim() : "";
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || v.length > 254) throw new ApiError(400, "Invalid email address");
          value = v;
          break;
        }
        case "phone": {
          const v = typeof raw === "string" ? raw.trim() : "";
          if (!/^[+()\d\s.-]{5,30}$/.test(v) || !/\d{5,}/.test(v.replace(/\D/g, ""))) throw new ApiError(400, "Invalid phone number");
          value = v;
          break;
        }
        case "url": {
          let v = typeof raw === "string" ? raw.trim() : "";
          if (v && !/^[a-z][a-z0-9+.-]*:/i.test(v)) v = `https://${v}`;
          let ok = false;
          try {
            const u = new URL(v);
            ok = (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
          } catch {
            ok = false;
          }
          if (!ok || v.length > 500) throw new ApiError(400, "Invalid web address (must start with http:// or https://)");
          value = v;
          break;
        }
        case "date": {
          const v = typeof raw === "string" ? raw.trim() : "";
          const d = new Date(`${v}T00:00:00.000Z`);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
            throw new ApiError(400, "Invalid date");
          }
          value = v;
          break;
        }
        case "yesno": {
          const v = raw === true ? "yes" : raw === false ? "no" : raw;
          if (v !== "yes" && v !== "no") throw new ApiError(400, "Invalid yes/no value");
          value = v;
          break;
        }
        case "multiselect": {
          if (!Array.isArray(raw) || raw.some((x) => typeof x !== "string" || !f.options.includes(x))) {
            throw new ApiError(400, "Invalid dropdown option");
          }
          const picked = f.options.filter((o) => (raw as string[]).includes(o)); // keep option order, drop duplicates
          value = picked.length ? picked : undefined;
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
        case "table": {
          if (!isTableValue(raw) || raw.rows.length > MAX_TABLE_ROWS) throw new ApiError(400, "Invalid table");
          const cols = f.options.length;
          const rows = raw.rows
            .map((r) => {
              if (!Array.isArray(r)) throw new ApiError(400, "Invalid table");
              return Array.from({ length: cols }, (_, i) => (typeof r[i] === "string" ? r[i].trim().slice(0, 300) : ""));
            })
            .filter((r) => r.some(Boolean));
          value = rows.length ? { rows } : undefined;
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
      if (f.required && enforceRequired) missing.add(f.id);
    } else {
      data[f.id] = value;
    }
  }

  // Answers to fields that are hidden by a condition are dropped and never required.
  const hidden = fields.filter((f) => !isFieldVisible(f, data, fields));
  for (const f of hidden) {
    delete data[f.id];
    missing.delete(f.id);
  }
  if (missing.size > 0) throw new ApiError(400, "A required custom field is missing");

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

/** Table columns: same clean-up as options, but few and short. */
export function normalizeColumns(input: unknown): string[] {
  const cols = normalizeOptions(input);
  if (cols.length === 0) throw new ApiError(400, "Add at least one column");
  if (cols.length > MAX_TABLE_COLUMNS) throw new ApiError(400, "Too many columns (max 8)");
  return cols;
}

/**
 * Validate a "show only if" condition sent by the client. Returns the JSON to store
 * ("" = no condition). The controlling field must exist, differ from the field
 * itself and must not lead back to it.
 */
export function normalizeShowIf(input: unknown, selfId: string | null, fields: CandidateField[]): string {
  if (input === null || input === undefined || input === "") return "";
  if (typeof input !== "object" || Array.isArray(input)) throw new ApiError(400, "Invalid condition");
  const src = input as Record<string, unknown>;
  const fieldId = typeof src.fieldId === "string" ? src.fieldId : "";
  if (!fieldId) return "";
  const op = typeof src.op === "string" ? src.op : "";
  if (!(SHOW_OPS as readonly string[]).includes(op)) throw new ApiError(400, "Invalid condition");
  const parent = fields.find((f) => f.id === fieldId);
  if (!parent) throw new ApiError(400, "Condition field not found");
  if (selfId && fieldId === selfId) throw new ApiError(400, "A field cannot depend on itself");
  // walk up the chain: it must never reach this field
  let cur: CandidateField | undefined = parent;
  for (let i = 0; cur && i < 50; i++) {
    if (selfId && cur.id === selfId) throw new ApiError(400, "Conditions cannot form a loop");
    cur = cur.showIf ? fields.find((f) => f.id === cur!.showIf!.fieldId) : undefined;
  }
  let value = typeof src.value === "string" ? src.value.trim().slice(0, 200) : "";
  if (op !== "filled") {
    if (!value) throw new ApiError(400, "Choose the value that shows this field");
    if (parent.type === "yesno" && value !== "yes" && value !== "no") throw new ApiError(400, "Invalid condition");
    if (hasOptions(parent.type) && !parent.options.includes(value)) throw new ApiError(400, "Invalid condition");
  } else {
    value = "";
  }
  return JSON.stringify({ fieldId, op, value });
}
