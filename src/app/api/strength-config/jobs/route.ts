import { handle, json, requireAdmin } from "@/lib/api";
import { listModifiedJobs } from "@/lib/strength-server";

export const dynamic = "force-dynamic";

/** GET /api/strength-config/jobs — the jobs that have their own candidate strength setup (administrators). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    return json(await listModifiedJobs());
  });
}
