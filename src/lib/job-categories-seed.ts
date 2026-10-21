// Server-only: makes sure the classification tree has its ISCO-08 starter data.

import { db } from "@/lib/db";
import { parseSeed } from "@/lib/job-categories-seed-data";

let running: Promise<void> | null = null;

async function seed() {
  if ((await db.jobCategory.count()) > 0) return;
  // the administrator emptied the classification on purpose: keep it empty
  const org = await db.organization.findUnique({ where: { id: "org" } }).catch(() => null);
  if (org?.categoriesCleared) return;
  const idByCode = new Map<string, { id: string; level: number }>();
  // Parents always come before their children in the list.
  for (const row of parseSeed()) {
    // "0" is a major group; "01"-"03" hang under it like every other 2-digit code.
    const parentCode = row.code.length > 1 ? row.code.slice(0, -1) : null;
    const parent = parentCode ? idByCode.get(parentCode) : undefined;
    const level = parent ? parent.level + 1 : 1;
    const created = await db.jobCategory.create({
      data: { code: row.code, name: row.name, nameCkb: row.nameCkb, level, parentId: parent?.id ?? null },
    });
    idByCode.set(row.code, { id: created.id, level });
  }
}

export function ensureJobCategories(): Promise<void> {
  if (!running) {
    running = seed().finally(() => {
      running = null;
    });
  }
  return running;
}
