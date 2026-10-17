import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAuth } from "@/lib/api";

/** PUT /api/candidate-fields/reorder — body: { ids: string[] } in the desired order. */
export async function PUT(req: Request) {
  return handle(async () => {
    await requireAuth(req);
    const body = await readJson<{ ids?: unknown }>(req);
    if (!Array.isArray(body.ids) || body.ids.some((i) => typeof i !== "string")) {
      throw new ApiError(400, "ids are required");
    }
    const ids = body.ids as string[];
    await db.$transaction(
      ids.map((id, index) => db.candidateField.updateMany({ where: { id }, data: { sortOrder: index } }))
    );
    return json({ ok: true });
  });
}
