import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { ApiError, handle, json, readJson, str } from "@/lib/api";
import { candidateCookie, createCandidateToken } from "@/lib/candidate-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isValidPhone, phoneKey } from "@/lib/phone";

const DUMMY = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.xwlKQlQeW1D5G9m0o6kZ3v5pZ3O6";

/** POST /api/candidate/login — candidate username or phone number + password. */
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(`cand-login:${clientIp(req)}`, 20, 15 * 60 * 1000);
    const body = await readJson<Record<string, unknown>>(req);
    const username = str(body.username).trim().toLowerCase();
    const password = str(body.password);
    if (!username || !password) throw new ApiError(400, "Username or phone number and password are required");
    let account = await db.candidateAccount.findUnique({ where: { username } });
    if (!account && isValidPhone(username)) account = await db.candidateAccount.findUnique({ where: { phoneKey: phoneKey(username) } });
    const ok = await verifyPassword(password, account?.passwordHash ?? DUMMY).catch(() => false);
    if (!account || !ok) throw new ApiError(401, "Invalid username, phone number or password");
    const res = json({ ok: true });
    res.headers.append("Set-Cookie", candidateCookie(req, await createCandidateToken(account.id)));
    return res;
  });
}
