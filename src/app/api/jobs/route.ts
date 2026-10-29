import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAuth, requireLevel, str } from "@/lib/api";
import { normalizeRequirements } from "@/lib/job-requirements-server";
import { resolveSpecialist } from "@/lib/job-specialist";
import { ensureTitle } from "@/lib/job-titles";
import { EMPLOYMENT_TYPES, JOB_STATUSES } from "@/lib/constants";

/**
 * GET /api/jobs — jobs with application counts.
 * Filters: status, categoryId (includes sub-classes), q (title / location / skills).
 * `page` + `pageSize` → `{ items, total, page, pageSize }`; `light=1&limit=N` → a short list of
 * {id,title,location,status,categoryId} for pickers; otherwise the plain array (capped at 2000).
 */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAuth(req);
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status");
    const categoryId = sp.get("categoryId") || undefined;
    const q = (sp.get("q") ?? "").trim().slice(0, 100);
    const sqlite = (process.env.DATABASE_URL ?? "file:").startsWith("file:");
    const has = (v: string) => (sqlite ? { contains: v } : { contains: v, mode: "insensitive" as const });
    const and: Prisma.JobWhereInput[] = [];
    if (status) and.push({ status });
    const title = (sp.get("title") ?? "").trim().slice(0, 200);
    if (title) and.push({ title });
    const spec = sp.get("specialist");
    if (spec === "yes") and.push({ specialist: true });
    if (spec === "no") and.push({ specialist: false });
    const note = (sp.get("specialistNote") ?? "").trim().slice(0, 500);
    if (note) and.push({ specialist: true, specialistNote: note });
    const ann = sp.get("announced");
    if (ann === "yes") and.push({ announced: true });
    if (ann === "no") and.push({ announced: false });
    if (q) and.push({ OR: [{ title: has(q) }, { location: has(q) }, { skills: has(q) }] });
    if (categoryId) {
      const cats = await db.jobCategory.findMany({ select: { id: true, parentId: true } });
      const kids = new Map<string, string[]>();
      for (const c of cats) if (c.parentId) kids.set(c.parentId, [...(kids.get(c.parentId) ?? []), c.id]);
      const ids = new Set([categoryId]);
      const stack = [categoryId];
      while (stack.length) for (const k of kids.get(stack.pop()!) ?? []) if (!ids.has(k)) (ids.add(k), stack.push(k));
      and.push({ categoryId: { in: [...ids] } });
    }
    const where: Prisma.JobWhereInput | undefined = and.length ? { AND: and } : undefined;
    const orderBy: Prisma.JobOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

    if (sp.get("light") === "1") {
      const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "30", 10) || 30));
      return json(
        await db.job.findMany({ where, orderBy, take: limit, select: { id: true, title: true, location: true, status: true, categoryId: true, specialist: true, specialistNote: true } })
      );
    }
    if (sp.get("page")) {
      const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
      const pageSize = Math.min(200, Math.max(1, parseInt(sp.get("pageSize") ?? "50", 10) || 50));
      const [total, items] = await Promise.all([
        db.job.count({ where }),
        db.job.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: { _count: { select: { applications: true } } } }),
      ]);
      return json({ items, total, page, pageSize });
    }
    return json(await db.job.findMany({ where, orderBy, take: 2000, include: { _count: { select: { applications: true } } } }));
  });
}

/** POST /api/jobs — create a job */
export async function POST(req: Request) {
  return handle(async () => {
    await requireLevel(req, "jobs", "edit");
    const body = await readJson<Record<string, unknown>>(req);
    const title = str(body.title).trim();
    if (!title) throw new ApiError(400, "Job title is required");
    const employmentType = str(body.employmentType, "Full-time");
    if (!(EMPLOYMENT_TYPES as readonly string[]).includes(employmentType)) {
      throw new ApiError(400, "Invalid employment type");
    }
    const jobStatus = str(body.status, "Open");
    if (!(JOB_STATUSES as readonly string[]).includes(jobStatus)) {
      throw new ApiError(400, "Invalid job status");
    }
    const categoryId = str(body.categoryId) || null;
    if (!categoryId) throw new ApiError(400, "Please choose a job classification");
    if (categoryId && !(await db.jobCategory.findUnique({ where: { id: categoryId } }))) {
      throw new ApiError(400, "Category not found");
    }
    await ensureTitle(title);
    const sp = await resolveSpecialist({ title, categoryId, specialist: body.specialist, note: body.specialistNote });
    const requirements = await normalizeRequirements(body.requirements);
    const job = await db.job.create({
      data: {
        ...sp,
        announced: body.announced === true,
        requirements,
        requirementsNote: str(body.requirementsNote).trim().slice(0, 2000),
        categoryId,
        title,
        description: str(body.description),
        skills: str(body.skills),
        experience: str(body.experience),
        location: str(body.location),
        salary: str(body.salary),
        employmentType,
        status: jobStatus,
      },
      include: { _count: { select: { applications: true } } },
    });
    return json(job, 201);
  });
}
