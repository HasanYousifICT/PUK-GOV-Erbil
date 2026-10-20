import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ApiError, handle, json, readJson, requireLevel, str } from "@/lib/api";
import { generateUniqueCode, USERNAME_RE, usernameProblem } from "@/lib/candidate-auth";
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

/**
 * POST /api/candidate-accounts — create a candidate login; a unique code is generated.
 * Only the phone number is required (and unique); the username is optional, and the candidate
 * can sign in with either. With `candidateId` the login is attached to a candidate who already exists.
 */
export async function POST(req: Request) {
  return handle(async () => {
    await requireLevel(req, "access", "edit");
    const body = await readJson<Record<string, unknown>>(req);
    const username = str(body.username).trim().toLowerCase();
    const password = str(body.password);
    let fullName = str(body.fullName).trim().slice(0, 100);
    let email = str(body.email).trim().toLowerCase().slice(0, 254);
    const candidateId = str(body.candidateId);
    const rawPhone = str(body.phone);
    if (!rawPhone.trim()) throw new ApiError(400, "Phone number is required");
    if (!isValidPhone(rawPhone)) throw new ApiError(400, "Please enter a valid phone number");
    const phone = cleanPhone(rawPhone);
    const key = phoneKey(rawPhone);
    if (username) {
      const problem = usernameProblem(username);
      if (problem) throw new ApiError(400, problem);
    }
    if (password.length < 6) throw new ApiError(400, "Password must be at least 6 characters");
    if (email && !EMAIL_RE.test(email)) throw new ApiError(400, "Please enter a valid email address");
    await assertPhoneFree(key);
    if (username && (await db.candidateAccount.findUnique({ where: { username }, select: { id: true } }))) {
      throw new ApiError(409, "This username is already taken");
    }

    // attach to an existing candidate (the candidate list's "Create access" button)
    let candidate: { id: string; name: string; email: string; phone: string; code: string | null } | null = null;
    if (candidateId) {
      candidate = await db.candidate.findUnique({ where: { id: candidateId }, select: { id: true, name: true, email: true, phone: true, code: true } });
      if (!candidate) throw new ApiError(404, "Candidate not found");
      if (await db.candidateAccount.findUnique({ where: { candidateId }, select: { id: true } })) {
        throw new ApiError(409, "This candidate already has access");
      }
      fullName = fullName || candidate.name;
      email = email || candidate.email.toLowerCase();
    }

    // keep the candidate's own code when it is free, so the CV keeps showing the same one
    let code = candidate?.code ?? "";
    if (!code || (await db.candidateAccount.findUnique({ where: { code }, select: { id: true } }))) code = await generateUniqueCode();

    const account = await db.candidateAccount.create({
      data: {
        username: username || null,
        passwordHash: await hashPassword(password),
        code,
        fullName,
        email,
        phone,
        phoneKey: key,
        ...(candidate ? { candidateId: candidate.id, submittedAt: new Date() } : {}),
      },
      select: accountSelect,
    });
    if (candidate) {
      await db.candidate.update({ where: { id: candidate.id }, data: { code, ...(candidate.phone ? {} : { phone }) } });
    }
    return json(account, 201);
  });
}
