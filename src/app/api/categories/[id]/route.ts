import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAuth, requireLevel, str } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

/** PUT /api/categories/:id — rename / recode a category (its place in the tree is fixed). */
export async function PUT(req: Request, { params }: Params) {
  return handle(async () => {
    await requireLevel(req, "classification", "edit");
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(req);
    const existing = await db.jobCategory.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Category not found");

    const data: { name?: string; code?: string; nameCkb?: string } = {};
    if ("name" in body) {
      const name = str(body.name).trim();
      if (!name) throw new ApiError(400, "Category name is required");
      const duplicate = await db.jobCategory.findFirst({
        where: { parentId: existing.parentId, name, NOT: { id } },
      });
      if (duplicate) throw new ApiError(409, "A category with this name already exists here");
      data.name = name;
    }
    if ("code" in body) data.code = str(body.code).trim();
    if ("nameCkb" in body) data.nameCkb = str(body.nameCkb).trim();

    const updated = await db.jobCategory.update({
      where: { id },
      data,
      include: { _count: { select: { jobs: true } } },
    });
    return json(updated);
  });
}

/** DELETE /api/categories/:id — only leaf categories; jobs in it simply become unclassified. */
export async function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    await requireLevel(req, "classification", "edit");
    const { id } = await params;
    const existing = await db.jobCategory.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Category not found");
    const children = await db.jobCategory.count({ where: { parentId: id } });
    if (children > 0) throw new ApiError(400, "Delete the sub-categories first");
    await db.jobCategory.delete({ where: { id } });
    return json({ ok: true });
  });
}
