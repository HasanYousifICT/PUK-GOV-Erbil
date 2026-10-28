import type { Prisma } from "@prisma/client";
import { withTitleCkb } from "@/lib/job-titles";
import { db } from "@/lib/db";
import { handle, json, requireCandidate } from "@/lib/api-candidate";
import { checkJob, quotaOf, requireProfile } from "@/lib/candidate-jobs";

const isSqlite = () => (process.env.DATABASE_URL ?? "file:").startsWith("file:");

/** GET /api/candidate/jobs?page&pageSize&q — open jobs announced to candidates, with the requirements checked against this candidate's profile. */
export async function GET(req: Request) {
  return handle(async () => {
    const account = await requireCandidate(req);
    const candidate = await requireProfile(account.candidateId);
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "10", 10) || 10));
    const where: Prisma.JobWhereInput = {
      status: "Open",
      announced: true,
      ...(q ? { title: isSqlite() ? { contains: q } : { contains: q, mode: "insensitive" } } : {}),
    };
    const [total, rows, quota, mine] = await Promise.all([
      db.job.count({ where }),
      db.job.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      quotaOf(candidate.id),
      db.application.findMany({ where: { candidateId: candidate.id }, select: { jobId: true } }),
    ]);
    const applied = new Set(mine.map((a) => a.jobId));
    const ckbs = await withTitleCkb(rows);
    const items = await Promise.all(
      rows.map(async (j, i) => {
        const requirements = await checkJob(j, candidate as never);
        const isApplied = applied.has(j.id);
        const unmet = requirements.filter((r) => !r.met).length;
        return {
          id: j.id,
          title: j.title,
          titleCkb: ckbs[i].titleCkb,
          description: j.description,
          skills: j.skills,
          experience: j.experience,
          location: j.location,
          salary: j.salary,
          employmentType: j.employmentType,
          categoryId: j.categoryId,
          specialist: j.specialist,
          specialistNote: j.specialistNote,
          requirementsNote: j.requirementsNote,
          requirements,
          applied: isApplied,
          canApply: !isApplied && unmet === 0 && (quota.remaining === null || quota.remaining > 0),
          createdAt: j.createdAt,
        };
      })
    );
    return json({ items, total, page, pageSize, quota });
  });
}
