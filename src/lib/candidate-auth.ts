// Candidate portal sessions: a separate cookie from staff sessions.
import { SignJWT, jwtVerify } from "jose";
import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";

export const CAND_COOKIE = "oroos_cand";
const DAYS = 7;

function key(): Uint8Array {
  const secret = process.env.JWT_SECRET || "openrecruitos-dev-secret-change-me-in-production";
  return new TextEncoder().encode(secret + ":candidate");
}

export async function createCandidateToken(accountId: string): Promise<string> {
  return new SignJWT({ sub: accountId, kind: "candidate" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DAYS}d`)
    .sign(key());
}

export type CandidateAccountRow = NonNullable<Awaited<ReturnType<typeof db.candidateAccount.findUnique>>>;

export async function getCandidateAccount(req: Request): Promise<CandidateAccountRow | null> {
  const header = req.headers.get("cookie") || "";
  const m = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CAND_COOKIE}=`));
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(decodeURIComponent(m.slice(CAND_COOKIE.length + 1)), key());
    if (!payload.sub || payload.kind !== "candidate") return null;
    return await db.candidateAccount.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

export async function requireCandidate(req: Request): Promise<CandidateAccountRow> {
  const a = await getCandidateAccount(req);
  if (!a) throw new ApiError(401, "Please sign in");
  return a;
}

export function candidateCookie(req: Request, token: string | null): string {
  const env = process.env.COOKIE_SECURE;
  const https =
    env === "true" ||
    (env !== "false" &&
      (req.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https" || new URL(req.url).protocol === "https:"));
  const value = token === null ? "" : encodeURIComponent(token);
  const maxAge = token === null ? 0 : DAYS * 86400;
  return `${CAND_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${https ? "; Secure" : ""}`;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** Unique candidate code such as CAND-7K3QX2. */
export async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    let s = "";
    for (let j = 0; j < 6; j++) s += ALPHABET[randomInt(ALPHABET.length)];
    const code = `CAND-${s}`;
    const taken =
      (await db.candidateAccount.findUnique({ where: { code }, select: { id: true } })) ||
      (await db.candidate.findUnique({ where: { code }, select: { id: true } }));
    if (!taken) return code;
  }
  throw new ApiError(500, "Could not generate a unique code, try again");
}

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,39}$/;
