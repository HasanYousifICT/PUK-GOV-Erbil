import { db } from "@/lib/db";
import { ensureAdminExists } from "@/lib/auth";
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
    const user = await db.user.update({
      where: { id: session.id },
      data: { name },
      select: { id: true, name: true, email: true, role: true },
    });
    return json(user);
  });
}
