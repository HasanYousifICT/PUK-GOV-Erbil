import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ApiError, handle, json, readJson, requireAdmin, str } from "@/lib/api";
import { generateUniqueCode, USERNAME_RE } from "@/lib/candidate-auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const accountSelect = {
  id: true,
  username: true,
  code: true,
  fullName: true,
  email: true,
  candidateId: true,
  submittedAt: true,
  createdAt: true,
} as const;

/** GET /api/candidate-accounts — candidate logins (administrators only). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    return json(await db.candidateAccount.findMany({ select: accountSelect, orderBy: { createdAt: "desc" } }));
  });
}

/** POST /api/candidate-accounts — create a candidate login; a unique code is generated. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const username = str(body.username).trim().toLowerCase();
    const password = str(body.password);
    const fullName = str(body.fullName).trim().slice(0, 100);
    const email = str(body.email).trim().toLowerCase().slice(0, 254);
    if (!USERNAME_RE.test(username)) {
      throw new ApiError(400, "Username must be 3–40 characters: letters, numbers, dot, dash or underscore");
    }
    if (password.length < 6) throw new ApiError(400, "Password must be at least 6 characters");
    if (email && !EMAIL_RE.test(email)) throw new ApiError(400, "Please enter a valid email address");
    if (await db.candidateAccount.findUnique({ where: { username }, select: { id: true } })) {
      throw new ApiError(409, "This username is already taken");
    }
    const account = await db.candidateAccount.create({
      data: { username, passwordHash: await hashPassword(password), code: await generateUniqueCode(), fullName, email },
      select: accountSelect,
    });
    return json(account, 201);
  });
}
