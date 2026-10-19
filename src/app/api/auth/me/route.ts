import { db } from "@/lib/db";
import { ensureAdminExists, SESSION_SELECT, toSessionUser } from "@/lib/auth";
import { requireAuth, handle, json, readJson, str, ApiError } from "@/lib/api";

export async function GET(req: Request) {
  return handle(async () => {
    await requireAuth(req);
    await ensureAdminExists();
    const user = await requireAuth(req);
    return json(user);
  });
}

/** Update profile (name). */
export async function PUT(req: Request) {
  return handle(async () => {
    const session = await requireAuth(req);
    const body = await readJson<{ name?: string }>(req);
    const name = str(body.name).trim();
    if (!name) throw new ApiError(400, "Name is required");
    const clash = (await db.user.findMany({ where: { NOT: { id: session.id } }, select: { name: true } })).some(
      (u) => u.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (clash) throw new ApiError(409, "A user with this name already exists");
    const user = await db.user.update({ where: { id: session.id }, data: { name }, select: SESSION_SELECT });
    return json(toSessionUser(user));
  });
}
