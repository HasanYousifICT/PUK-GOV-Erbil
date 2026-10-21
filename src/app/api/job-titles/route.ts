import { db } from "@/lib/db";
import { ensureTitle, findTitle, normTitle } from "@/lib/job-titles";
import { ApiError, handle, json, readJson, requireAuth, requireLevel, str } from "@/lib/api";

/** GET /api/job-titles — the static list of job titles, with how many jobs use each. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAuth(req);
    let [rows, jobs] = await Promise.all([
      db.jobTitle.findMany({ orderBy: { title: "asc" } }),
      db.job.findMany({ select: { title: true } }),
    ]);
    // jobs created before the list existed: put their titles into the list once
    const known = new Set(rows.map((r: { title: string }) => normTitle(r.title)));
    let added = false;
    for (const j of jobs as { title: string }[]) {
      if (known.has(normTitle(j.title))) continue;
      known.add(normTitle(j.title));
      await ensureTitle(j.title);
      added = true;
    }
    if (added) rows = await db.jobTitle.findMany({ orderBy: { title: "asc" } });
    const used = new Map<string, number>();
    for (const j of jobs as { title: string }[]) used.set(normTitle(j.title), (used.get(normTitle(j.title)) ?? 0) + 1);
    return json(rows.map((r: { title: string }) => ({ ...r, jobCount: used.get(normTitle(r.title)) ?? 0 })));
  });
}

/** POST /api/job-titles — add a title to the list. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireLevel(req, "jobs", "edit");
    const body = await readJson<Record<string, unknown>>(req);
    const title = str(body.title).replace(/\s+/g, " ").trim();
    if (!title) throw new ApiError(400, "Job title is required");
    const dup = await findTitle(title);
    if (dup) throw new ApiError(409, "This job title is already in the list", { id: dup.id });
    const row = await db.jobTitle.create({ data: { title, titleCkb: str(body.titleCkb).trim() } });
    return json({ ...row, jobCount: 0 }, 201);
  });
}
