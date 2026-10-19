import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ApiError, handle, json, readJson, requireLevel, str } from "@/lib/api";
import { generateUniqueCode, USERNAME_RE } from "@/lib/candidate-auth";
import { cleanPhone, isValidPhone, phoneKey } from "@/lib/phone";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const accountSelect = {
  id: true,
  username: true,
  code: true,
  fullName: true,
  email: true,
  phone: true,
  candidateId: true,
  submittedAt: true,
  draftAt: true,
  createdAt: true,
} as const;

/**
 * Throws 409 "Candidate duplicate" (with the id of the existing access, so the screen can open it)
 * when another candidate access already uses this phone number.
 */
export async function assertPhoneFree(key: string, exceptId?: string) {
  const other = await db.candidateAccount.findUnique({
    where: { phoneKey: key },
    select: { id: true, username: true, fullName: true, phone: true },
  });
  if (other && other.id !== exceptId) {
    throw new ApiError(409, "Candidate duplicate", {
      duplicate: { id: other.id, username: other.username, fullName: other.fullName, phone: other.phone ?? "" },
    });
  }
}

/** GET /api/candidate-accounts — candidate logins. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireLevel(req, "access", "view");
    return json(await db.candidateAccount.findMany({ select: accountSelect, orderBy: { createdAt: "desc" } }));
  });
}

/** POST /api/candidate-accounts — create a candidate login; a unique code is generated. The phone number is required and unique. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireLevel(req, "access", "edit");
    const body = await readJson<Record<string, unknown>>(req);
    const username = str(body.username).trim().toLowerCase();
    const password = str(body.password);
    const fullName = str(body.fullName).trim().slice(0, 100);
    const email = str(body.email).trim().toLowerCase().slice(0, 254);
    const rawPhone = str(body.phone);
    if (!rawPhone.trim()) throw new ApiError(400, "Phone number is required");
    if (!isValidPhone(rawPhone)) throw new ApiError(400, "Please enter a valid phone number");
    const phone = cleanPhone(rawPhone);
    const key = phoneKey(rawPhone);
    if (!USERNAME_RE.test(username)) {
      throw new ApiError(400, "Username must be 3–40 characters: letters, numbers, dot, dash or underscore");
    }
    if (password.length < 6) throw new ApiError(400, "Password must be at least 6 characters");
    if (email && !EMAIL_RE.test(email)) throw new ApiError(400, "Please enter a valid email address");
    await assertPhoneFree(key);
    if (await db.candidateAccount.findUnique({ where: { username }, select: { id: true } })) {
      throw new ApiError(409, "This username is already taken");
    }
    const account = await db.candidateAccount.create({
      data: { username, passwordHash: await hashPassword(password), code: await generateUniqueCode(), fullName, email, phone, phoneKey: key },
      select: accountSelect,
    });
    return json(account, 201);
  });
}
