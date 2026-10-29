import { resolveInterviewers, statusFor } from "@/lib/interview-server";
import { parseIds } from "@/lib/interview-rules";
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
    await requireLevel(req, "interviews", "edit");
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(req);
    const existing = await db.interview.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Interview not found");

    const data: Record<string, string | boolean> = {};
    let ids = parseIds(existing.interviewerIds);
    let requireAll = existing.requireAll;
    let doneIds = parseIds(existing.doneIds);
    let touched = false;
    if ("interviewerIds" in body) {
      const people = await resolveInterviewers(body.interviewerIds);
      ids = people.ids;
      data.interviewer = people.names;
      data.interviewerIds = JSON.stringify(ids);
      doneIds = doneIds.filter((d) => ids.includes(d));
      touched = true;
    }
    if ("requireAll" in body) {
      requireAll = ids.length > 1 ? body.requireAll !== false : true;
      touched = true;
    }
    if (ids.length <= 1) requireAll = true;
    if (touched) data.requireAll = requireAll;
    if ("doneIds" in body) {
      doneIds = parseIds(body.doneIds).filter((d) => ids.includes(d));
      touched = true;
    }
    if (touched) data.doneIds = JSON.stringify(doneIds);
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
      data.status = status;
    } else if (touched && ids.length > 0) {
      data.status = statusFor(existing.status, requireAll, ids, doneIds);
    }

    const interview = await db.interview.update({
      where: { id },
      data,
      include: INCLUDE,
    });
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
