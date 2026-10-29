import { notifyCandidate, notifyUsers, usersWith } from "@/lib/notify-server";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAuth, requireLevel, str } from "@/lib/api";

const MAX_BATCH = 1000;

/**
 * POST /api/applications/bulk — add many candidates to one job in a single step.
 * Body: { candidateIds: string[], jobId: string }
 * Every new application starts at "Applied" with a history entry; candidates already
 * in the job are skipped, never duplicated.
 */
export async function POST(req: Request) {
  return handle(async () => {
    await requireLevel(req, "applications", "edit");
    const body = await readJson<{ candidateIds?: unknown; jobId?: unknown }>(req);
    const jobId = str(body.jobId);
    if (!jobId) throw new ApiError(400, "candidateId and jobId are required");
    if (!Array.isArray(body.candidateIds) || body.candidateIds.some((c) => typeof c !== "string")) {
      throw new ApiError(400, "Select at least one candidate");
    }
    const ids = [...new Set(body.candidateIds as string[])];
    if (ids.length === 0) throw new ApiError(400, "Select at least one candidate");
    if (ids.length > MAX_BATCH) throw new ApiError(400, "Too many candidates selected (max 1000)");

    const job = await db.job.findUnique({ where: { id: jobId } });
    if (!job) throw new ApiError(404, "Job not found");
    if (job.status !== "Open") throw new ApiError(400, "This job is closed");

    const found = await db.candidate.findMany({ where: { id: { in: ids } }, select: { id: true } });
    const already = await db.application.findMany({
      where: { jobId, candidateId: { in: ids } },
      select: { candidateId: true },
    });
    const alreadySet = new Set(already.map((a) => a.candidateId));
    const toCreate = found.map((c) => c.id).filter((id) => !alreadySet.has(id));

    await db.$transaction(
      toCreate.map((candidateId) =>
        db.application.create({
          data: {
            candidateId,
            jobId,
            stage: "Applied",
            status: "Active",
            history: { create: { previousStage: "", newStage: "Applied" } },
          },
        })
      )
    );

    for (const cid of toCreate) await notifyCandidate(cid, "app_added", { job: job.title }, { tab: "mine" });
    return json({
      created: toCreate.length,
      skipped: alreadySet.size,
      missing: ids.length - found.length,
      jobTitle: job.title,
    });
  });
}
