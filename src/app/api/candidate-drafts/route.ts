import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireLevel, str } from "@/lib/api";
import { cleanDraftData, draftLabel, MAX_DRAFTS } from "@/lib/candidate-drafts";

/** GET /api/candidate-drafts — the signed-in user's own saved drafts (newest first). */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireLevel(req, "candidates", "edit");
    const rows = await db.candidateDraft.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, label: true, updatedAt: true, createdAt: true },
    });
    return json(rows);
  });
}

/** POST /api/candidate-drafts — save a new draft. */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireLevel(req, "candidates", "edit");
    const body = await readJson<Record<string, unknown>>(req);
    const data = cleanDraftData(body.data);
    if ((await db.candidateDraft.count({ where: { userId: user.id } })) >= MAX_DRAFTS) {
      throw new ApiError(400, "Too many saved drafts — finish or delete some first");
    }
    const row = await db.candidateDraft.create({
      data: { userId: user.id, label: draftLabel(data, str(body.label)), data: JSON.stringify(data) },
      select: { id: true, label: true, updatedAt: true, createdAt: true },
    });
    return json(row, 201);
  });
}
