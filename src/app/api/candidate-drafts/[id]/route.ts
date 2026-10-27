import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireLevel, str } from "@/lib/api";
import { cleanDraftData, draftLabel } from "@/lib/candidate-drafts";

type Params = { params: Promise<{ id: string }> };

async function mine(req: Request, params: Params["params"]) {
  const user = await requireLevel(req, "candidates", "edit");
  const { id } = await params;
  const row = await db.candidateDraft.findUnique({ where: { id } });
  // other people's drafts look like they do not exist
  if (!row || row.userId !== user.id) throw new ApiError(404, "Draft not found");
  return row;
}

/** GET /api/candidate-drafts/:id — the saved form. */
export async function GET(req: Request, { params }: Params) {
  return handle(async () => {
    const row = await mine(req, params);
    return json({ id: row.id, label: row.label, updatedAt: row.updatedAt, data: cleanDraftData(safeParse(row.data)) });
  });
}

/** PUT /api/candidate-drafts/:id — overwrite the draft with the current form. */
export async function PUT(req: Request, { params }: Params) {
  return handle(async () => {
    const row = await mine(req, params);
    const body = await readJson<Record<string, unknown>>(req);
    const data = cleanDraftData(body.data);
    const updated = await db.candidateDraft.update({
      where: { id: row.id },
      data: { label: draftLabel(data, str(body.label)), data: JSON.stringify(data) },
      select: { id: true, label: true, updatedAt: true, createdAt: true },
    });
    return json(updated);
  });
}

/** DELETE /api/candidate-drafts/:id */
export async function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    const row = await mine(req, params);
    await db.candidateDraft.deleteMany({ where: { id: row.id } });
    return json({ ok: true });
  });
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
