import { db } from "@/lib/db";

/** Lower-cased, whitespace-collapsed form used to detect duplicate titles. */
export const normTitle = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Find a title in the list ignoring case and extra spaces. */
export async function findTitle(title: string, exceptId?: string) {
  const key = normTitle(title);
  const all = await db.jobTitle.findMany();
  return all.find((r: { id: string; title: string }) => r.id !== exceptId && normTitle(r.title) === key) ?? null;
}

/** Add a title to the list when it is not there yet (used when a job is saved). */
export async function ensureTitle(title: string) {
  const clean = title.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const found = await findTitle(clean);
  if (found) return found;
  return db.jobTitle.create({ data: { title: clean } });
}


/** Adds `titleCkb` (the Kurdish name from the job-title list, or "") to rows that have a `title`. */
export async function withTitleCkb<T extends { title: string }>(rows: T[]): Promise<(T & { titleCkb: string })[]> {
  if (!rows.length) return [];
  const all = await db.jobTitle.findMany({ select: { title: true, titleCkb: true } });
  const map = new Map<string, string>(all.map((r: { title: string; titleCkb: string }) => [normTitle(r.title), r.titleCkb] as [string, string]));
  return rows.map((r) => ({ ...r, titleCkb: map.get(normTitle(r.title)) ?? "" }));
}
