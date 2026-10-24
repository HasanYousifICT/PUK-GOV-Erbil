import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAuth, requireLevel, str } from "@/lib/api";

const APP_INCLUDE = {
  candidate: { select: { id: true, name: true, email: true, phone: true, skills: true, experience: true, location: true, resume: true, resumeName: true } },
  job: { select: { id: true, title: true, location: true, employmentType: true, status: true, categoryId: true } },
  history: { orderBy: { changedAt: "asc" as const } },
  interviews: { orderBy: { date: "desc" as const } },
};

/**
 * GET /api/applications — applications with candidate, job, stage history and interviews.
 * Filters: jobId, candidateId, stage, status, categoryId (includes sub-classes), q (candidate name / phone / e-mail).
 * Plain call returns an array (optionally capped by `limit`); `board=1` returns `{ items, counts }`
 * with at most `perStage` newest items per stage (use `stage` + `offset` to load more of one column).
 */
export async function GET(req: Request) {
  return handle(async () => {
    await requireLevel(req, "applications", "view");
    const sp = new URL(req.url).searchParams;
    const jobId = sp.get("jobId") || undefined;
    const candidateId = sp.get("candidateId") || undefined;
    const stage = sp.get("stage") || undefined;
    const status = sp.get("status") || undefined;
    const categoryId = sp.get("categoryId") || undefined;
    const q = (sp.get("q") ?? "").trim().slice(0, 100);
    const board = sp.get("board") === "1";
    const num = (k: string, d: number, max: number) => Math.min(max, Math.max(0, parseInt(sp.get(k) ?? "", 10) || d));
    const sqlite = (process.env.DATABASE_URL ?? "file:").startsWith("file:");
    const has = (v: string) => (sqlite ? { contains: v } : { contains: v, mode: "insensitive" as const });

    const and: Prisma.ApplicationWhereInput[] = [];
    if (jobId) and.push({ jobId });
    if (candidateId) and.push({ candidateId });
    if (status) and.push({ status });
    if (categoryId) {
      const cats = await db.jobCategory.findMany({ select: { id: true, parentId: true } });
      const kids = new Map<string, string[]>();
      for (const c of cats) if (c.parentId) kids.set(c.parentId, [...(kids.get(c.parentId) ?? []), c.id]);
      const ids = new Set([categoryId]);
      const stack = [categoryId];
      while (stack.length) for (const k of kids.get(stack.pop()!) ?? []) if (!ids.has(k)) (ids.add(k), stack.push(k));
      and.push({ job: { categoryId: { in: [...ids] } } });
    }
    if (q) {
      // find matching candidates first (indexed scan), then filter applications by id — far faster than joining
      const hits = await db.candidate.findMany({
        where: { OR: [{ name: has(q) }, { phone: has(q) }, { email: has(q) }] },
        select: { id: true },
        take: 500,
      });
      and.push({ candidateId: { in: hits.map((h) => h.id) } });
    }
    const base: Prisma.ApplicationWhereInput = and.length ? { AND: and } : {};
    const orderBy: Prisma.ApplicationOrderByWithRelationInput[] = [{ appliedAt: "desc" }, { id: "desc" }];

    if (board) {
      const perStage = num("perStage", 40, 200) || 40;
      const offset = num("offset", 0, 1_000_000);
      const grouped = await db.application.groupBy({ by: ["stage"], where: base, _count: { _all: true } });
      const counts: Record<string, number> = {};
      for (const g of grouped) counts[g.stage] = g._count._all;
      const stages = stage ? [stage] : Object.keys(counts);
      const lists = await Promise.all(
        stages.map((st) => db.application.findMany({ where: { AND: [base, { stage: st }] }, orderBy, skip: offset, take: perStage, include: APP_INCLUDE }))
      );
      return json({ items: lists.flat(), counts });
    }

    const limit = num("limit", 0, 5000);
    const applications = await db.application.findMany({
      where: { AND: [base, ...(stage ? [{ stage }] : [])] },
      orderBy,
      ...(limit ? { take: limit } : {}),
      include: APP_INCLUDE,
    });
    return json(applications);
  });
}

/** POST /api/applications — add a candidate to a job (starts at Applied) */
export async function POST(req: Request) {
  return handle(async () => {
    await requireLevel(req, "applications", "edit");
    const body = await readJson<{ candidateId?: string; jobId?: string }>(req);
    const candidateId = str(body.candidateId);
    const jobId = str(body.jobId);
    if (!candidateId || !jobId) throw new ApiError(400, "candidateId and jobId are required");

    const candidate = await db.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new ApiError(404, "Candidate not found");
    const job = await db.job.findUnique({ where: { id: jobId } });
    if (!job) throw new ApiError(404, "Job not found");

    const dup = await db.application.findUnique({
      where: { candidateId_jobId: { candidateId, jobId } },
    });
    if (dup) throw new ApiError(409, "This candidate is already applied to this job");

    const application = await db.application.create({
      data: {
        candidateId,
        jobId,
        stage: "Applied",
        status: "Active",
        history: { create: { previousStage: "", newStage: "Applied" } },
      },
      include: {
        candidate: { select: { id: true, name: true, email: true, phone: true, skills: true, experience: true, location: true, resume: true, resumeName: true } },
        job: { select: { id: true, title: true, location: true, employmentType: true, status: true } },
        history: true,
        interviews: true,
      },
    });
    return json(application, 201);
  });
}
