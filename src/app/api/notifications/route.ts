import { db } from "@/lib/db";
import { handle, json, requireAuth } from "@/lib/api";
import { listFor } from "@/lib/notify-list";

/** GET /api/notifications — this user's notifications, plus "action required" items worked out from today's data. */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireAuth(req);
    const { items, unread } = await listFor("user", user.id);
    // action required: interviews that are due and still wait for this interviewer's evaluation
    const today = new Date().toISOString().slice(0, 10);
    const due = await db.interview.findMany({
      where: { status: "Scheduled", date: { lte: today }, interviewerIds: { contains: `"${user.id}"` } },
      orderBy: [{ date: "asc" }],
      take: 50,
      select: { id: true, date: true, time: true, evaluations: true, application: { select: { id: true, candidate: { select: { name: true } }, job: { select: { title: true } } } } },
    });
    const actions = due
      .filter((i) => {
        try {
          return !(user.id in (JSON.parse(i.evaluations) as Record<string, unknown>));
        } catch {
          return true;
        }
      })
      .map((i) => ({ id: i.id, candidate: i.application.candidate.name, job: i.application.job.title, date: i.date, time: i.time }));
    return json({ items, unread, actions });
  });
}
