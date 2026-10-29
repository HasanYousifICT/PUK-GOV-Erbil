import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** The job conditions of a list's filters: jobId, categoryId (with sub-classes), title, specialist, specialistNote, jobStatus. */
export async function jobWhereFromParams(sp: URLSearchParams): Promise<Prisma.JobWhereInput> {
  const w: Prisma.JobWhereInput = {};
  const jobId = sp.get("jobId");
  if (jobId) w.id = jobId;
  const title = (sp.get("title") ?? "").trim().slice(0, 200);
  if (title) w.title = title;
  const spec = sp.get("specialist");
  if (spec === "yes") w.specialist = true;
  if (spec === "no") w.specialist = false;
  const note = (sp.get("specialistNote") ?? "").trim().slice(0, 500);
  if (note) {
    w.specialist = true;
    w.specialistNote = note;
  }
  const st = sp.get("jobStatus");
  if (st === "Open" || st === "Closed") w.status = st;
  const categoryId = sp.get("categoryId");
  if (categoryId) {
    const cats = await db.jobCategory.findMany({ select: { id: true, parentId: true } });
    const kids = new Map<string, string[]>();
    for (const c of cats) if (c.parentId) kids.set(c.parentId, [...(kids.get(c.parentId) ?? []), c.id]);
    const ids = new Set([categoryId]);
    const stack = [categoryId];
    while (stack.length) for (const k of kids.get(stack.pop()!) ?? []) if (!ids.has(k)) (ids.add(k), stack.push(k));
    w.categoryId = { in: [...ids] };
  }
  return w;
}
