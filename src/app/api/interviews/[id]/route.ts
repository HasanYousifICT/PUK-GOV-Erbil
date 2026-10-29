import { notifyCandidate, notifyUsers, usersWith } from "@/lib/notify-server";
import { applicationFacts } from "@/lib/notify-server";
import { cleanEvaluation, resolveInterviewers, statusFor } from "@/lib/interview-server";
import { parseEvaluations, parseIds } from "@/lib/interview-rules";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAuth, requireLevel, str } from "@/lib/api";
import { isValidInterviewStatus } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

const INCLUDE = {
  application: {
    select: {
      id: true,
      stage: true,
      candidate: { select: { id: true, name: true, email: true } },
      job: { select: { id: true, title: true, location: true } },
    },
  },
};

/** PUT /api/interviews/:id — edit details, complete/cancel, add feedback */
export async function PUT(req: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireLevel(req, "interviews", "edit");
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(req);
    const existing = await db.interview.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Interview not found");

    const data: Record<string, string | boolean> = {};
    let ids = parseIds(existing.interviewerIds);
    let requireAll = existing.requireAll;
    let evals = parseEvaluations(existing.evaluations);
    let touched = false;
    if ("interviewerIds" in body) {
      const people = await resolveInterviewers(body.interviewerIds);
      ids = people.ids;
      data.interviewer = people.names;
      data.interviewerIds = JSON.stringify(ids);
      evals = Object.fromEntries(Object.entries(evals).filter(([k]) => ids.includes(k)));
      touched = true;
    }
    if ("requireAll" in body) {
      requireAll = ids.length > 1 ? body.requireAll !== false : true;
      touched = true;
    }
    if (ids.length <= 1) requireAll = true;
    if (touched) data.requireAll = requireAll;
    // each interviewer writes their own evaluation (an administrator may write any)
    if (body.evaluations && typeof body.evaluations === "object") {
      for (const [uid, e] of Object.entries(body.evaluations as Record<string, unknown>)) {
        if (!ids.includes(uid)) continue;
        if (uid !== user.id && user.role !== "admin") throw new ApiError(403, "You can only write your own evaluation");
        if (e === null) delete evals[uid];
        else evals[uid] = cleanEvaluation(e);
      }
      touched = true;
    }
    const doneIds = Object.keys(evals);
    if (touched) {
      data.evaluations = JSON.stringify(evals);
      data.doneIds = JSON.stringify(doneIds);
    }
    if ("date" in body) {
      const date = str(body.date).trim();
      if (!date) throw new ApiError(400, "Date is required");
      data.date = date;
    }
    if ("time" in body) {
      const time = str(body.time).trim();
      if (!time) throw new ApiError(400, "Time is required");
      data.time = time;
    }
    if ("feedback" in body) data.feedback = str(body.feedback);
    if ("status" in body) {
      const status = str(body.status);
      if (!isValidInterviewStatus(status)) throw new ApiError(400, "Invalid interview status");
      // "Completed" is automatic: it happens when the required interviewers have submitted their evaluation
      if (status === "Completed" && ids.length > 0) throw new ApiError(400, "An interview is completed automatically when the interviewers submit their evaluations");
      data.status = status === "Scheduled" && ids.length > 0 ? statusFor("Scheduled", requireAll, ids, doneIds) : status;
    } else if (touched && ids.length > 0) {
      data.status = statusFor(existing.status, requireAll, ids, doneIds);
    }

    const interview = await db.interview.update({
      where: { id },
      data,
      include: INCLUDE,
    });
    // tell the people involved what changed
    const facts = await applicationFacts(existing.applicationId);
    if (facts) {
      const date = interview.date;
      const time = interview.time;
      const idsNow = parseIds(interview.interviewerIds);
      const idsBefore = parseIds(existing.interviewerIds);
      const link = { view: "interviews" };
      if (interview.status === "Cancelled" && existing.status !== "Cancelled") {
        await notifyCandidate(facts.candidateId, "iv_cancelled", { job: facts.job, date, time }, { tab: "mine" });
        await notifyUsers(idsNow.filter((x) => x !== user.id), "iv_cancelled_staff", { candidate: facts.candidate, job: facts.job }, link);
      } else if (interview.status !== "Cancelled" && (existing.date !== date || existing.time !== time)) {
        await notifyCandidate(facts.candidateId, "iv_changed", { job: facts.job, date, time }, { tab: "mine" });
        await notifyUsers(idsNow.filter((x) => x !== user.id), "iv_changed_staff", { candidate: facts.candidate, job: facts.job, date, time }, link);
      }
      const added = idsNow.filter((x) => !idsBefore.includes(x) && x !== user.id);
      if (added.length && interview.status !== "Cancelled") await notifyUsers(added, "iv_assigned", { candidate: facts.candidate, job: facts.job, date, time }, link);
      if (interview.status === "Completed" && existing.status !== "Completed") {
        await notifyUsers(await usersWith("applications"), "iv_completed", { candidate: facts.candidate, job: facts.job }, { view: "applications", focusApplicationId: facts.applicationId });
      }
    }
    return json(interview);
  });
}

/** DELETE /api/interviews/:id */
export async function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    await requireLevel(req, "interviews", "edit");
    const { id } = await params;
    const existing = await db.interview.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Interview not found");
    await db.interview.delete({ where: { id } });
    return json({ ok: true });
  });
}
