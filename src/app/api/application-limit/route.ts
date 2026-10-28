import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAdmin } from "@/lib/api";
import { getMaxApplications } from "@/lib/candidate-jobs";

/** GET /api/application-limit — how many jobs one candidate may apply to (0 = no limit). Administrators only. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    return json({ maxApplications: await getMaxApplications() });
  });
}

/** PUT /api/application-limit { maxApplications } */
export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const n = Number(body.maxApplications);
    if (!Number.isInteger(n) || n < 0 || n > 1000) throw new ApiError(400, "Enter a whole number from 0 to 1000 (0 means no limit)");
    await db.organization.upsert({
      where: { id: "org" },
      create: { id: "org", name: "OpenRecruitOS", maxApplications: n },
      update: { maxApplications: n },
    });
    return json({ maxApplications: n });
  });
}
