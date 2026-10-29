import { canDo } from "@/lib/interview-actions";
import { notifyCandidate, notifyUsers, usersWith } from "@/lib/notify-server";
import { applicationFacts } from "@/lib/notify-server";
import { jobWhereFromParams } from "@/lib/job-filter-server";
import { resolveInterviewers } from "@/lib/interview-server";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAuth, requireLevel, str } from "@/lib/api";

/** GET /api/interviews — all interviews with application → candidate & job context */
export async function GET(req: Request) {
  return handle(async () => {
    await requireLevel(req, "interviews", "view");
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const sqlite = (process.env.DATABASE_URL ?? "file:").startsWith("file:");
    const has = (v: string) => (sqlite ? { contains: v } : { contains: v, mode: "insensitive" as const });
    const and: Record<string, unknown>[] = [];
    if (status) and.push({ status });
    const jobWhere = await jobWhereFromParams(url.searchParams);
    if (Object.keys(jobWhere).length) and.push({ application: { job: jobWhere } });
    const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
    const from = day(url.searchParams.get("from"));
    const to = day(url.searchParams.get("to"));
    if (from) and.push({ date: { gte: from } });
    if (to) and.push({ date: { lte: to } });
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    if (q) and.push({ OR: [{ interviewer: has(q) }, { application: { candidate: { name: has(q) } } }] });
    const interviews = await db.interview.findMany({
      where: and.length ? { AND: and } : undefined,
      take: 3000,
      orderBy: [{ date: "asc" }, { time: "asc" }],
      include: {
        application: {
          select: {
            id: true,
            stage: true,
            candidate: { select: { id: true, name: true, email: true } },
            job: { select: { id: true, title: true, location: true } },
          },
        },
      },
    });
    return json(interviews);
  });
}

/** POST /api/interviews — schedule an interview for an application */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireLevel(req, "interviews", "edit");
    if (!canDo(me.interviewActions, me.role, "schedule")) throw new ApiError(403, "You are not allowed to schedule interviews");
    const body = await readJson<Record<string, unknown>>(req);
    const applicationId = str(body.applicationId);
    const people = await resolveInterviewers(body.interviewerIds);
    const requireAll = people.ids.length > 1 ? body.requireAll !== false : true;
    const date = str(body.date).trim();
    const time = str(body.time).trim();
    if (!applicationId) throw new ApiError(400, "Application is required");
    if (!date || !time) throw new ApiError(400, "Date and time are required");

    const application = await db.application.findUnique({ where: { id: applicationId } });
    if (!application) throw new ApiError(404, "Application not found");

    const interview = await db.interview.create({
      data: {
        applicationId,
        interviewer: people.names,
        interviewerIds: JSON.stringify(people.ids),
        requireAll,
        date,
        time,
        status: "Scheduled",
        feedback: str(body.feedback),
      },
      include: {
        application: {
          select: {
            id: true,
            stage: true,
            candidate: { select: { id: true, name: true, email: true } },
            job: { select: { id: true, title: true, location: true } },
          },
        },
      },
    });
    const facts = await applicationFacts(applicationId);
    if (facts) {
      const when = { date, time };
      await notifyCandidate(facts.candidateId, "iv_scheduled", { job: facts.job, ...when }, { tab: "mine" });
      await notifyUsers(people.ids, "iv_assigned", { candidate: facts.candidate, job: facts.job, ...when }, { view: "interviews" });
    }
    return json(interview, 201);
  });
}
