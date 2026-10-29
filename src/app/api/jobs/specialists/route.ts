import { db } from "@/lib/db";
import { handle, json, requireAuth } from "@/lib/api";

/** GET /api/jobs/specialists — the distinct specialist descriptions in use (for the Jobs filter). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAuth(req);
    const rows = await db.job.findMany({
      where: { specialist: true, NOT: { specialistNote: "" } },
      distinct: ["specialistNote"],
      select: { specialistNote: true },
      orderBy: { specialistNote: "asc" },
      take: 500,
    });
    return json(rows.map((r: { specialistNote: string }) => r.specialistNote));
  });
}
