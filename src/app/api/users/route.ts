import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ApiError, handle, json, readJson, requireAdmin, str } from "@/lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const select = { id: true, name: true, email: true, role: true, createdAt: true } as const;

/** GET /api/users — all accounts (administrators only). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    return json(await db.user.findMany({ select, orderBy: { createdAt: "asc" } }));
  });
}

/** POST /api/users — an administrator creates an account. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const name = str(body.name).trim();
    const email = str(body.email).trim().toLowerCase();
    const password = str(body.password);
    const role = body.role === "admin" ? "admin" : "recruiter";
    if (name.length < 2 || name.length > 100) throw new ApiError(400, "Please enter the full name (2–100 characters)");
    if (!EMAIL_RE.test(email) || email.length > 254) throw new ApiError(400, "Please enter a valid email address");
    if (password.length < 6) throw new ApiError(400, "Password must be at least 6 characters");
    if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ApiError(409, "An account with this email already exists.");
    }
    const user = await db.user.create({
      data: { name, email, role, password: await hashPassword(password) },
      select,
    });
    return json(user, 201);
  });
}
