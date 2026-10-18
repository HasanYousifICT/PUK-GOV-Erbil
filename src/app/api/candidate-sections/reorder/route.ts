import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAdmin } from "@/lib/api";

/** PUT /api/candidate-sections/reorder — body: { ids: string[] } */
export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const body = await readJson<{ ids?: unknown }>(req);
    if (!Array.isArray(body.ids) || body.ids.some((i) => typeof i !== "string")) {
      throw new ApiError(400, "ids are required");
    }
    await db.$transaction(
      (body.ids as string[]).map((id, index) => db.candidateSection.updateMany({ where: { id }, data: { sortOrder: index } }))
    );
    return json({ ok: true });
  });
}
