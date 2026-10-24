import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ApiError, handle, json, readJson, requireLevel, str } from "@/lib/api";
import { accountSelect, assertPhoneFree } from "../route";
import { usernameProblem } from "@/lib/candidate-auth";
import { cleanPhone, isValidPhone, phoneKey } from "@/lib/phone";

type Ctx = { params: Promise<{ id: string }> };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** GET /api/candidate-accounts/:id — details of one candidate access. */
export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireLevel(req, "access", "view");
    const { id } = await params;
    const a = await db.candidateAccount.findUnique({ where: { id }, select: accountSelect });
    if (!a) throw new ApiError(404, "Account not found");
    return json(a);
  });
}

/** PUT /api/candidate-accounts/:id — reset password / edit the name, e-mail and phone. */
export async function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireLevel(req, "access", "edit");
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(req);
    const data: Record<string, string | null> = {};
    if (body.password !== undefined) {
      const p = str(body.password);
      if (p.length < 6) throw new ApiError(400, "Password must be at least 6 characters");
      data.passwordHash = await hashPassword(p);
    }
    if (body.username !== undefined) {
      const u = str(body.username).trim().toLowerCase();
      if (!u) {
        data.username = null;
      } else {
        const problem = usernameProblem(u);
        if (problem) throw new ApiError(400, problem);
        const other = await db.candidateAccount.findUnique({ where: { username: u }, select: { id: true } });
        if (other && other.id !== id) throw new ApiError(409, "This username is already taken");
        data.username = u;
      }
    }
    if (body.fullName !== undefined) data.fullName = str(body.fullName).trim().slice(0, 100);
    if (body.email !== undefined) {
      const e = str(body.email).trim().toLowerCase().slice(0, 254);
      if (e && !EMAIL_RE.test(e)) throw new ApiError(400, "Please enter a valid email address");
      data.email = e;
    }
    if (body.phone !== undefined) {
      const raw = str(body.phone);
      if (!raw.trim()) throw new ApiError(400, "Phone number is required");
      if (!isValidPhone(raw)) throw new ApiError(400, "Please enter a valid phone number");
      await assertPhoneFree(phoneKey(raw), id);
      data.phone = cleanPhone(raw);
      data.phoneKey = phoneKey(raw);
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
    await requireLevel(req, "access", "edit");
    const { id } = await params;
    const account = await db.candidateAccount.findUnique({ where: { id }, select: { candidateId: true } });
    const r = await db.candidateAccount.deleteMany({ where: { id } });
    if (r.count === 0) throw new ApiError(404, "Account not found");
    if (account?.candidateId) await db.candidate.updateMany({ where: { id: account.candidateId }, data: { hasAccess: false } });
    return json({ ok: true });
  });
}
