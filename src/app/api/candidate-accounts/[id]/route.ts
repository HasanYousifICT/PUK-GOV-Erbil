import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ApiError, handle, json, readJson, requireAdmin, str } from "@/lib/api";
import { accountSelect } from "../route";

type Ctx = { params: Promise<{ id: string }> };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PUT /api/candidate-accounts/:id — reset password / edit the optional name and e-mail. */
export async function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin(req);
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(req);
    const data: Record<string, string> = {};
    if (body.password !== undefined) {
      const p = str(body.password);
      if (p.length < 6) throw new ApiError(400, "Password must be at least 6 characters");
      data.passwordHash = await hashPassword(p);
    }
    if (body.fullName !== undefined) data.fullName = str(body.fullName).trim().slice(0, 100);
    if (body.email !== undefined) {
      const e = str(body.email).trim().toLowerCase().slice(0, 254);
      if (e && !EMAIL_RE.test(e)) throw new ApiError(400, "Please enter a valid email address");
      data.email = e;
    }
    if (!(await db.candidateAccount.findUnique({ where: { id }, select: { id: true } }))) {
      throw new ApiError(404, "Account not found");
    }
    return json(await db.candidateAccount.update({ where: { id }, data, select: accountSelect }));
  });
}

/** DELETE /api/candidate-accounts/:id — remove the login (the candidate record is kept). */
export async function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin(req);
    const { id } = await params;
    const r = await db.candidateAccount.deleteMany({ where: { id } });
    if (r.count === 0) throw new ApiError(404, "Account not found");
    return json({ ok: true });
  });
}
