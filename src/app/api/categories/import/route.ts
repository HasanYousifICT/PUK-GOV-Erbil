import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAuth, requireLevel, str } from "@/lib/api";
import { MAX_CATEGORY_DEPTH } from "@/lib/categories";
import { ensureJobCategories } from "@/lib/job-categories-seed";

const MAX_ROWS = 20000;

/** Minimal CSV parser (quotes, escaped quotes, CRLF). */
function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

/**
 * POST /api/categories/import — bulk-load categories from CSV text.
 * Columns: code, name, parent_code, name_ckb (the first row may be a header).
 * Rows whose code already exists are skipped; parents are referenced by code.
 */
export async function POST(req: Request) {
  return handle(async () => {
    await requireLevel(req, "classification", "edit");
    const body = await readJson<Record<string, unknown>>(req);
    const csv = str(body.csv).replace(/^﻿/, "");
    if (!csv.trim()) throw new ApiError(400, "CSV content is required");

    const firstLine = csv.split(/\r?\n/, 1)[0] ?? "";
    const delimiter = !firstLine.includes(",") && firstLine.includes(";") ? ";" : !firstLine.includes(",") && firstLine.includes("\t") ? "\t" : ",";
    let rows = parseCsv(csv, delimiter);
    if (rows.length && /^code$/i.test((rows[0][0] ?? "").trim())) rows = rows.slice(1);
    if (rows.length > MAX_ROWS) throw new ApiError(400, "Too many rows (max 20000)");

    await ensureJobCategories();
    const existing = await db.jobCategory.findMany({ select: { id: true, code: true, level: true } });
    const byCode = new Map<string, { id: string; level: number }>();
    for (const c of existing) if (c.code) byCode.set(c.code, { id: c.id, level: c.level });

    type Row = { code: string; name: string; parentCode: string; nameCkb: string };
    let pending: Row[] = rows
      .map((r) => ({
        code: (r[0] ?? "").trim(),
        name: (r[1] ?? "").trim(),
        parentCode: (r[2] ?? "").trim(),
        nameCkb: (r[3] ?? "").trim(),
      }))
      .filter((r) => r.name);

    let created = 0;
    let skipped = 0;
    // Place rows whose parent is known; repeat until nothing more can be placed.
    for (let pass = 0; pass < MAX_CATEGORY_DEPTH + 2 && pending.length; pass++) {
      const next: Row[] = [];
      for (const r of pending) {
        if (r.code && byCode.has(r.code)) {
          skipped++;
          continue;
        }
        let parentId: string | null = null;
        let level = 1;
        if (r.parentCode) {
          const parent = byCode.get(r.parentCode);
          if (!parent) {
            next.push(r);
            continue;
          }
          parentId = parent.id;
          level = parent.level + 1;
        }
        if (level > MAX_CATEGORY_DEPTH) {
          skipped++;
          continue;
        }
        const row = await db.jobCategory.create({
          data: { code: r.code, name: r.name, nameCkb: r.nameCkb, level, parentId },
        });
        if (r.code) byCode.set(r.code, { id: row.id, level });
        created++;
      }
      const stuck = next.length === pending.length;
      pending = next;
      if (stuck) break;
    }
    return json({ created, skipped, failed: pending.length });
  });
}
