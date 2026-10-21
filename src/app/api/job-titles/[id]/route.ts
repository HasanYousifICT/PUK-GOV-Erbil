import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireLevel, str } from "@/lib/api";
import { findTitle } from "@/lib/job-titles";

type Params = { params: Promise<{ id: string }> };

/** PUT /api/job-titles/:id — rename a title or change its default classification. */
export async function PUT(req: Request, { params }: Params) {
  return handle(async () => {
    await requireLevel(req, "jobs", "edit");
    const { id } = await params;
    const existing = await db.jobTitle.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Job title not found");
    const body = await readJson<Record<string, unknown>>(req);
    const data: Record<string, string | null> = {};
    if ("title" in body) {
      const title = str(body.title).replace(/\s+/g, " ").trim();
      if (!title) throw new ApiError(400, "Job title is required");
      const dup = await findTitle(title, id);
      if (dup) throw new ApiError(409, "This job title is already in the list", { id: dup.id });
      data.title = title;
    }
    if ("titleCkb" in body) data.titleCkb = str(body.titleCkb).trim();
    if ("categoryId" in body) {
      const categoryId = str(body.categoryId) || null;
      if (!categoryId) throw new ApiError(400, "Please choose a job classification");
      if (categoryId && !(await db.jobCategory.findUnique({ where: { id: categoryId } }))) {
        throw new ApiError(400, "Category not found");
      }
      data.categoryId = categoryId;
    }
    const row = await db.jobTitle.update({ where: { id }, data });
    return json(row);
  });
}

/** DELETE /api/job-titles/:id — remove from the list (existing jobs keep their title). */
export async function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    await requireLevel(req, "jobs", "edit");
    const { id } = await params;
    const existing = await db.jobTitle.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Job title not found");
    await db.jobTitle.delete({ where: { id } });
    return json({ ok: true });
  });
}
