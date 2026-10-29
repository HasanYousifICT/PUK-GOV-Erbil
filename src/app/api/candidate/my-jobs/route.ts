import { withTitleCkb } from "@/lib/job-titles";
import { db } from "@/lib/db";
import { handle, json, requireCandidate } from "@/lib/api-candidate";
import { quotaOf, requireProfile } from "@/lib/candidate-jobs";

/** GET /api/candidate/my-jobs — every job this candidate applied to, with its pipeline stage, plus the quota. */
export async function GET(req: Request) {
  return handle(async () => {
    const account = await requireCandidate(req);
    const candidate = await requireProfile(account.candidateId);
    const [apps, quota] = await Promise.all([
      db.application.findMany({
        where: { candidateId: candidate.id },
        orderBy: { appliedAt: "desc" },
        include: {
          job: { select: { id: true, title: true, location: true, employmentType: true } },
          // only what the candidate needs: when, with whom, and whether it is still on (never the evaluations or feedback)
          interviews: { select: { id: true, date: true, time: true, interviewer: true, status: true }, orderBy: [{ date: "asc" }, { time: "asc" }] },
        },
      }),
      quotaOf(candidate.id),
    ]);
    const titles = await withTitleCkb(apps.map((a) => ({ title: a.job.title })));
    return json({
      quota,
      items: apps.map((a, i) => ({
        titleCkb: titles[i].titleCkb,
        id: a.id,
        jobId: a.jobId,
        title: a.job.title,
        location: a.job.location,
        employmentType: a.job.employmentType,
        stage: a.stage,
        status: a.status,
        appliedAt: a.appliedAt,
        interviews: a.interviews,
      })),
    });
  });
}
