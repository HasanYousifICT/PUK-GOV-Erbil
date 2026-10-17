import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAuth, str } from "@/lib/api";
import { MAX_CATEGORY_DEPTH } from "@/lib/categories";
import { ensureJobCategories } from "@/lib/job-categories-seed";

/** GET /api/categories — the whole classification tree as a flat list (with job counts). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAuth(req);
    await ensureJobCategories();
    const rows = await db.jobCategory.findMany({
      orderBy: [{ code: "asc" }, { name: "asc" }],
      include: { _count: { select: { jobs: true } } },
    });
    return json(rows);
  });
}

/** POST /api/categories — add a category (top level, or under `parentId`). */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAuth(req);
    const body = await readJson<Record<string, unknown>>(req);
    const name = str(body.name).trim();
    if (!name) throw new ApiError(400, "Category name is required");
    const parentId = str(body.parentId) || null;

    let level = 1;
    if (parentId) {
      const parent = await db.jobCategory.findUnique({ where: { id: parentId } });
      if (!parent) throw new ApiError(404, "Parent category not found");
      level = parent.level + 1;
      if (level > MAX_CATEGORY_DEPTH) throw new ApiError(400, "Maximum category depth reached");
    }

    const duplicate = await db.jobCategory.findFirst({ where: { parentId, name } });
    if (duplicate) throw new ApiError(409, "A category with this name already exists here");

    const created = await db.jobCategory.create({
      data: { name, code: str(body.code).trim(), nameCkb: str(body.nameCkb).trim(), level, parentId },
      include: { _count: { select: { jobs: true } } },
    });
    return json(created, 201);
  });
}
