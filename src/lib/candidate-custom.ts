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
  parseColumnDefs,
  tableProblem,
  COLUMN_TYPES,
  ColumnDef,
  ColumnType,
  MAX_COLUMN_OPTIONS,
  MAX_CONDITIONS,
  ShowIf,
  ShowRule,
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
  columnDefs?: string;
  sortOrder: number;
};

export function serializeField(row: FieldRow): CandidateField {
  return {
    id: row.id,
    label: row.label,
    labelCkb: row.labelCkb,
    type: (FIELD_TYPES as readonly string[]).includes(row.type) ? (row.type as FieldType) : "text",
    options: parseOptions(row.options),
    columns: parseColumnDefs(row.columnDefs, row.type === "table" ? parseOptions(row.options).length : 0),
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
  const tableErrors = new Map<string, string>();

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
          const problem = tableProblem(f, rows);
          if (problem?.kind === "invalid") throw new ApiError(400, `Invalid value in the “${problem.column}” column`);
          if (problem?.kind === "required" && enforceRequired) tableErrors.set(f.id, `The “${problem.column}” column is required`);
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
  for (const f of hidden) tableErrors.delete(f.id);
  for (const msg of tableErrors.values()) throw new ApiError(400, msg);
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

/**
 * Table columns sent by the client: `[{ name, type, required, options }]` (an older client sends plain
 * names). Returns the names (stored in `options`) and one definition per column.
 */
export function normalizeColumnDefs(input: unknown): { names: string[]; defs: ColumnDef[] } {
  if (!Array.isArray(input) || input.length === 0) throw new ApiError(400, "Add at least one column");
  if (input.length > MAX_TABLE_COLUMNS) throw new ApiError(400, "Too many columns (max 8)");
  const names: string[] = [];
  const defs: ColumnDef[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    const o = (typeof item === "string" ? { name: item } : item) as Record<string, unknown> | null;
    const name = typeof o?.name === "string" ? o.name.trim() : "";
    if (!name) throw new ApiError(400, "Every column needs a name");
    if (name.length > 100) throw new ApiError(400, "Option is too long (max 100 characters)");
    if (seen.has(name.toLowerCase())) throw new ApiError(400, "Two columns have the same name");
    seen.add(name.toLowerCase());
    const type = (COLUMN_TYPES as readonly string[]).includes(o?.type as string) ? (o!.type as ColumnType) : "text";
    let options: string[] = [];
    if (type === "select") {
      options = normalizeOptions(o?.options);
      if (options.length === 0) throw new ApiError(400, `Add the choices for the “${name}” column`);
      if (options.length > MAX_COLUMN_OPTIONS) throw new ApiError(400, "Too many options (max 100)");
    }
    names.push(name);
    defs.push({ type, required: o?.required === true, options });
  }
  return { names, defs };
}

/** Kept for older callers: plain column names only. */
export function normalizeColumns(input: unknown): string[] {
  return normalizeColumnDefs(input).names;
}

function checkCond(src: unknown, selfId: string | null, fields: CandidateField[]): ShowIf | null {
  if (!src || typeof src !== "object" || Array.isArray(src)) throw new ApiError(400, "Invalid condition");
  const o = src as Record<string, unknown>;
  const fieldId = typeof o.fieldId === "string" ? o.fieldId : "";
  if (!fieldId) return null; // an unfinished row is simply dropped
  const op = typeof o.op === "string" ? o.op : "";
  if (!(SHOW_OPS as readonly string[]).includes(op)) throw new ApiError(400, "Invalid condition");
  const parent = fields.find((f) => f.id === fieldId);
  if (!parent) throw new ApiError(400, "Condition field not found");
  if (selfId && fieldId === selfId) throw new ApiError(400, "A field cannot depend on itself");
  // walk everything this condition's field depends on: it must never reach this field
  if (selfId) {
    const stack = [parent];
    const seen = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur.id === selfId) throw new ApiError(400, "Conditions cannot form a loop");
      if (seen.has(cur.id)) continue;
      seen.add(cur.id);
      for (const c of cur.showIf?.conds ?? []) {
        const next = fields.find((f) => f.id === c.fieldId);
        if (next) stack.push(next);
      }
    }
  }
  let value = typeof o.value === "string" ? o.value.trim().slice(0, 200) : "";
  if (op !== "filled") {
    if (!value) throw new ApiError(400, "Choose the value that shows this field");
    if (parent.type === "yesno" && value !== "yes" && value !== "no") throw new ApiError(400, "Invalid condition");
    if (hasOptions(parent.type) && !parent.options.includes(value)) throw new ApiError(400, "Invalid condition");
  } else {
    value = "";
  }
  return { fieldId, op: op as ShowIf["op"], value };
}

/**
 * Validate the "show only if" condition(s) sent by the client — one condition (older clients) or
 * `{ match: "all" | "any", conds: [...] }`. Returns the JSON to store ("" = always shown). Each
 * controlling field must exist, differ from the field itself and must not lead back to it.
 */
export function normalizeShowIf(input: unknown, selfId: string | null, fields: CandidateField[]): string {
  if (input === null || input === undefined || input === "") return "";
  if (typeof input !== "object" || Array.isArray(input)) throw new ApiError(400, "Invalid condition");
  const src = input as Record<string, unknown>;
  const list: unknown[] = Array.isArray(src.conds) ? src.conds : [src];
  if (list.length > MAX_CONDITIONS) throw new ApiError(400, "Too many conditions (max 10)");
  const conds = list.map((c) => checkCond(c, selfId, fields)).filter((c): c is ShowIf => !!c);
  if (conds.length === 0) return "";
  const rule: ShowRule = { match: src.match === "any" ? "any" : "all", conds };
  return JSON.stringify(rule);
}
