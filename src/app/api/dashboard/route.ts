import { db } from "@/lib/db";
import { handle, json, requireAuth } from "@/lib/api";
import { ALL_STAGES, STAGES } from "@/lib/constants";

/**
 * GET /api/dashboard — headline stats, pipeline counts and recent activity.
 * Intentionally simple: no advanced analytics in the Community Edition.
 */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAuth(req);

    const DAY = 86400000;
    const now = Date.now();
    const since30 = new Date(now - 30 * DAY);
    const today = new Date().toISOString().slice(0, 10);
    const [
      openJobs,
      totalJobs,
      totalCandidates,
      totalApplications,
      upcomingInterviews,
      totalInterviews,
      stageGroups,
      history,
      recentApps,
      recentCandidates,
      scheduled,
      jobs,
      accountsTotal,
      accountsSubmitted,
    ] = await Promise.all([
        db.job.count({ where: { status: "Open" } }),
        db.job.count(),
        db.candidate.count(),
        db.application.count(),
        db.interview.count({ where: { status: "Scheduled" } }),
        db.interview.count(),
        db.application.groupBy({ by: ["stage"], _count: { _all: true } }),
        db.applicationHistory.findMany({
          orderBy: { changedAt: "desc" },
          take: 10,
          include: {
            application: {
              select: {
                id: true,
                candidate: { select: { name: true } },
                job: { select: { title: true } },
              },
            },
          },
        }),
        db.application.findMany({ where: { appliedAt: { gte: since30 } }, select: { appliedAt: true } }),
        db.candidate.findMany({ where: { createdAt: { gte: new Date(now - 14 * DAY) } }, select: { createdAt: true } }),
        db.interview.findMany({
          where: { status: "Scheduled", date: { gte: today } },
          orderBy: [{ date: "asc" }, { time: "asc" }],
          take: 6,
          include: { application: { select: { candidate: { select: { id: true, name: true } }, job: { select: { title: true } } } } },
        }),
        db.job.findMany({
          where: { status: "Open" },
          select: { id: true, title: true, location: true, _count: { select: { applications: true } } },
        }),
        db.candidateAccount.count(),
        db.candidateAccount.count({ where: { candidateId: { not: null } } }),
      ]);

    // applications per day, last 30 days (oldest first, empty days included)
    const perDay = new Map<string, number>();
    for (let i = 29; i >= 0; i--) perDay.set(new Date(now - i * DAY).toISOString().slice(0, 10), 0);
    for (const a of recentApps) {
      const k = a.appliedAt.toISOString().slice(0, 10);
      if (perDay.has(k)) perDay.set(k, (perDay.get(k) ?? 0) + 1);
    }
    const applicationsByDay = Array.from(perDay, ([date, count]) => ({ date, count }));
    const last7 = recentApps.filter((a) => a.appliedAt.getTime() >= now - 7 * DAY).length;
    const prev7 = recentApps.filter((a) => a.appliedAt.getTime() < now - 7 * DAY && a.appliedAt.getTime() >= now - 14 * DAY).length;
    const cand7 = recentCandidates.filter((c) => c.createdAt.getTime() >= now - 7 * DAY).length;
    const candPrev7 = recentCandidates.length - cand7;

    const pipeline: Record<string, number> = {};
    for (const s of ALL_STAGES) pipeline[s] = 0;
    for (const g of stageGroups) pipeline[g.stage] = g._count._all;

    const hires = pipeline["Hired"] || 0;
    const rejected = pipeline["Rejected"] || 0;

    // Recent activity: stage moves (incl. initial "Applied") across the pipeline
    const recentActivity = history.map((h) => ({
      id: h.id,
      candidate: h.application.candidate.name,
      job: h.application.job.title,
      previousStage: h.previousStage,
      newStage: h.newStage,
      changedAt: h.changedAt,
    }));

    return json({
      stats: {
        openJobs,
        totalJobs,
        totalCandidates,
        totalApplications,
        upcomingInterviews,
        totalInterviews,
        hires,
        rejected,
      },
      trends: {
        applicationsByDay,
        applications7d: last7,
        applicationsPrev7d: prev7,
        candidates7d: cand7,
        candidatesPrev7d: candPrev7,
      },
      upcoming: scheduled.map((i) => ({
        id: i.id,
        date: i.date,
        time: i.time,
        interviewer: i.interviewer,
        candidateId: i.application.candidate.id,
        candidate: i.application.candidate.name,
        job: i.application.job.title,
      })),
      topJobs: jobs
        .sort((a, b) => b._count.applications - a._count.applications)
        .slice(0, 5)
        .map((j) => ({ id: j.id, title: j.title, location: j.location, applications: j._count.applications })),
      portal: { total: accountsTotal, submitted: accountsSubmitted },
      pipelineStages: STAGES,
      pipeline,
      recentActivity,
    });
  });
}
