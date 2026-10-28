import { db } from "@/lib/db";
import { ApiError, handle, json, requireCandidate } from "@/lib/api-candidate";
import { checkJob, getMaxApplications, requireProfile } from "@/lib/candidate-jobs";

type Params = { params: Promise<{ id: string }> };

/** POST /api/candidate/jobs/:id/apply — apply to an announced, open job when the profile meets every requirement and the limit allows it. */
export async function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const account = await requireCandidate(req);
    const candidate = await requireProfile(account.candidateId);
    const { id } = await params;
    const job = await db.job.findUnique({ where: { id } });
    if (!job || job.status !== "Open" || !job.announced) throw new ApiError(404, "This job is not available");

    const dup = await db.application.findUnique({ where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } } });
    if (dup) throw new ApiError(409, "You have already applied to this job");

    const results = await checkJob(job, candidate as never);
    const unmet = results.filter((r) => !r.met);
    if (unmet.length) {
      throw new ApiError(400, "Your profile does not meet the requirements of this job", { unmet });
    }

    const max = await getMaxApplications();
    await db.$transaction(async (tx) => {
      if (max > 0) {
        const used = await tx.application.count({ where: { candidateId: candidate.id } });
        if (used >= max) throw new ApiError(400, "You have reached the maximum number of jobs you can apply to");
      }
      const app = await tx.application.create({ data: { candidateId: candidate.id, jobId: job.id, stage: "Applied" } });
      await tx.applicationHistory.create({ data: { applicationId: app.id, previousStage: "", newStage: "Applied" } });
    });
    return json({ ok: true }, 201);
  });
}
