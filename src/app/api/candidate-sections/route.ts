import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAdmin, requireAuth, str } from "@/lib/api";
import { MAX_SECTIONS } from "@/lib/candidate-fields";
import { loadSections } from "@/lib/candidate-custom";

/** GET /api/candidate-sections — sections of the candidate profile, in order. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAuth(req);
    return json(await loadSections());
  });
}

/** POST /api/candidate-sections — add a section. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const name = str(body.name).trim();
    if (!name) throw new ApiError(400, "Section name is required");
    if (name.length > 100) throw new ApiError(400, "Section name is too long (max 100 characters)");
    const existing = await loadSections();
    if (existing.length >= MAX_SECTIONS) throw new ApiError(400, "Maximum number of sections reached");
    if (existing.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      throw new ApiError(409, "A section with this name already exists");
    }
    const sortOrder = existing.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1;
    const row = await db.candidateSection.create({
      data: { name, nameCkb: str(body.nameCkb).trim().slice(0, 100), sortOrder },
    });
    return json({ id: row.id, name: row.name, nameCkb: row.nameCkb, sortOrder: row.sortOrder }, 201);
  });
}
