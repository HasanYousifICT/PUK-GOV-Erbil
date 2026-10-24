import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ApiError, handle, json, readJson, requireAdmin, str } from "@/lib/api";
import { cleanPhone, isValidPhone, phoneKey } from "@/lib/phone";
import { ROLE_PRESETS, resolvePermissions, sanitizePermissions } from "@/lib/permissions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  title: true,
  permissions: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

type UserRow = { id: string; name: string; email: string; role: string; phone: string | null; title: string; permissions: string; active: boolean; lastLoginAt: Date | null; createdAt: Date };

/** What the screen receives: resolved permissions instead of the stored JSON. */
export function toManaged(u: UserRow) {
  const role = u.role === "admin" ? "admin" : "recruiter";
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role,
    phone: u.phone ?? "",
    title: u.title,
    permissions: resolvePermissions(role, u.permissions),
    active: u.active,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  };
}

/** Names are compared ignoring case and extra spaces. */
export const normName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export async function assertNameFree(name: string, exceptId?: string) {
  const rows = await db.user.findMany({ select: { id: true, name: true } });
  if (rows.some((u) => u.id !== exceptId && normName(u.name) === normName(name))) {
    throw new ApiError(409, "A user with this name already exists");
  }
}

export async function assertUserPhoneFree(key: string, exceptId?: string) {
  const other = await db.user.findUnique({ where: { phoneKey: key }, select: { id: true } });
  if (other && other.id !== exceptId) throw new ApiError(409, "A user with this phone number already exists");
}

/** GET /api/users — all accounts (administrators only). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    return json((await db.user.findMany({ select: userSelect, orderBy: { createdAt: "asc" } })).map(toManaged));
  });
}

/** POST /api/users — an administrator creates an account. Name, e-mail and phone must be unique. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const name = str(body.name).trim().replace(/\s+/g, " ");
    const email = str(body.email).trim().toLowerCase();
    const password = str(body.password);
    const role = body.role === "admin" ? "admin" : "recruiter";
    const title = str(body.title).trim().slice(0, 150);
    const rawPhone = str(body.phone);
    if (name.length < 2 || name.length > 100) throw new ApiError(400, "Please enter the full name (2–100 characters)");
    if (!EMAIL_RE.test(email) || email.length > 254) throw new ApiError(400, "Please enter a valid email address");
    if (!rawPhone.trim()) throw new ApiError(400, "Phone number is required");
    if (!isValidPhone(rawPhone)) throw new ApiError(400, "Please enter a valid phone number");
    if (password.length < 6) throw new ApiError(400, "Password must be at least 6 characters");
    await assertNameFree(name);
    await assertUserPhoneFree(phoneKey(rawPhone));
    if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ApiError(409, "An account with this email already exists.");
    }
    const permissions = role === "admin" ? ROLE_PRESETS[0].permissions : sanitizePermissions(body.permissions);
    const user = await db.user.create({
      data: {
        name,
        email,
        role,
        title,
        phone: cleanPhone(rawPhone),
        phoneKey: phoneKey(rawPhone),
        permissions: JSON.stringify(permissions),
        password: await hashPassword(password),
      },
      select: userSelect,
    });
    return json(toManaged(user), 201);
  });
}
