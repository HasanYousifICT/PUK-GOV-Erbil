import { db } from "@/lib/db";
import { ApiError, handle, json, requireAdmin } from "@/lib/api";
import { openPassword } from "@/lib/vault";

type Params = { params: Promise<{ id: string }> };

/** GET /api/users/:id/password — administrators only: the user's current password (if it is known). */
export async function GET(req: Request, { params }: Params) {
  return handle(async () => {
    await requireAdmin(req);
    const { id } = await params;
    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw new ApiError(404, "User not found");
    const res = json({ password: openPassword(user.passwordVault) });
    res.headers.set("Cache-Control", "no-store");
    return res;
  });
}
