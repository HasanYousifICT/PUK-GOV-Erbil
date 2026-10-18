import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ApiError, handle, json, readJson, requireAdmin, str } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };
const select = { id: true, name: true, email: true, role: true, createdAt: true } as const;

async function otherAdmins(id: string) {
  return db.user.count({ where: { role: "admin", NOT: { id } } });
}

/** PUT /api/users/:id — rename, change role or reset the password. */
export async function PUT(req: Request, { params }: Params) {
  return handle(async () => {
    const me = await requireAdmin(req);
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(req);
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "User not found");

    const data: { name?: string; role?: string; password?: string } = {};
    if ("name" in body) {
      const name = str(body.name).trim();
      if (name.length < 2 || name.length > 100) throw new ApiError(400, "Please enter the full name (2–100 characters)");
      data.name = name;
    }
    if ("role" in body) {
      const role = body.role === "admin" ? "admin" : "recruiter";
      if (role !== existing.role && existing.role === "admin" && (id === me.id || (await otherAdmins(id)) === 0)) {
        throw new ApiError(400, "There must be at least one administrator");
      }
      data.role = role;
    }
    if (str(body.password)) {
      if (str(body.password).length < 6) throw new ApiError(400, "Password must be at least 6 characters");
      data.password = await hashPassword(str(body.password));
    }
    return json(await db.user.update({ where: { id }, data, select }));
  });
}

/** DELETE /api/users/:id — remove an account (not yourself, not the last administrator). */
export async function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    const me = await requireAdmin(req);
    const { id } = await params;
    if (id === me.id) throw new ApiError(400, "You cannot delete your own account");
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "User not found");
    if (existing.role === "admin" && (await otherAdmins(id)) === 0) {
      throw new ApiError(400, "There must be at least one administrator");
    }
    await db.user.delete({ where: { id } });
    return json({ ok: true });
  });
}
