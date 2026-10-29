import { canMove } from "@/lib/stage-moves";
import { notifyCandidate, notifyUsers, usersWith } from "@/lib/notify-server";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAuth, requireLevel, str } from "@/lib/api";
import { isValidStage, statusForStage } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

/** GET /api/applications/:id — detail with history and interviews */
export async function GET(req: Request, { params }: Params) {
  return handle(async () => {
    await requireLevel(req, "applications", "view");
    const { id } = await params;
    const application = await db.application.findUnique({
      where: { id },
      include: {
        candidate: true,
        job: true,
        history: { orderBy: { changedAt: "asc" } },
        interviews: { orderBy: { date: "desc" } },
      },
    });
    if (!application) throw new ApiError(404, "Application not found");
    return json(application);
  });
}

/**
 * PUT /api/applications/:id — move application to another pipeline stage.
 * Records an ApplicationHistory entry for every stage change.
 * Moving to Hired / Rejected also derives the application status.
 */
export async function PUT(req: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireLevel(req, "applications", "edit");
    const { id } = await params;
    const body = await readJson<{ stage?: string }>(req);
    const stage = str(body.stage);
    if (!isValidStage(stage)) throw new ApiError(400, "Invalid pipeline stage");

    const existing = await db.application.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Application not found");
    if (existing.stage === stage) {
      return json(existing);
    }

    if (!canMove(user.stageMoves, user.role, existing.stage, stage)) {
      throw new ApiError(403, "You are not allowed to make this move in the pipeline");
    }

    const application = await db.application.update({
      where: { id },
      data: {
        stage,
        status: statusForStage(stage),
        history: { create: { previousStage: existing.stage, newStage: stage } },
      },
      include: {
        candidate: { select: { id: true, name: true, email: true, phone: true, skills: true, experience: true, location: true, resume: true, resumeName: true } },
        job: { select: { id: true, title: true, location: true, employmentType: true, status: true } },
        history: { orderBy: { changedAt: "asc" } },
        interviews: { orderBy: { date: "desc" } },
      },
    });
    await notifyCandidate(existing.candidateId, "app_stage", { job: application.job.title, stage }, { tab: "mine" });
    return json(application);
  });
}

/** DELETE /api/applications/:id — removes the application (history & interviews cascade) */
export async function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    await requireLevel(req, "applications", "edit");
    const { id } = await params;
    const existing = await db.application.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Application not found");
    await db.application.delete({ where: { id } });
    return json({ ok: true });
  });
}
