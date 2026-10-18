import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAdmin, str } from "@/lib/api";
import { loadSections } from "@/lib/candidate-custom";

type Params = { params: Promise<{ id: string }> };

/** PUT /api/candidate-sections/:id — rename. */
export async function PUT(req: Request, { params }: Params) {
  return handle(async () => {
    await requireAdmin(req);
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(req);
    const sections = await loadSections();
    if (!sections.some((s) => s.id === id)) throw new ApiError(404, "Section not found");
    const data: { name?: string; nameCkb?: string } = {};
    if ("name" in body) {
      const name = str(body.name).trim();
      if (!name) throw new ApiError(400, "Section name is required");
      if (name.length > 100) throw new ApiError(400, "Section name is too long (max 100 characters)");
      if (sections.some((s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase())) {
        throw new ApiError(409, "A section with this name already exists");
      }
      data.name = name;
    }
    if ("nameCkb" in body) data.nameCkb = str(body.nameCkb).trim().slice(0, 100);
    const row = await db.candidateSection.update({ where: { id }, data });
    return json({ id: row.id, name: row.name, nameCkb: row.nameCkb, sortOrder: row.sortOrder });
  });
}

/** DELETE /api/candidate-sections/:id — its fields move to the first remaining section. */
export async function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    await requireAdmin(req);
    const { id } = await params;
    const sections = await loadSections();
    if (!sections.some((s) => s.id === id)) throw new ApiError(404, "Section not found");
    if (sections.length <= 1) throw new ApiError(400, "At least one section must remain");
    const target = sections.find((s) => s.id !== id)!;
    await db.$transaction([
      db.candidateField.updateMany({ where: { sectionId: id }, data: { sectionId: target.id } }),
      db.candidateSection.delete({ where: { id } }),
    ]);
    return json({ ok: true });
  });
}
