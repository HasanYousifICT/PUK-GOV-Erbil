// OpenRecruitOS — Authentication (JWT session cookie + bcrypt password hashing)
// Kept intentionally simple for the Community Edition.
// Future commercial versions (SSO/SAML/SCIM) can replace this module behind the same interface.

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const COOKIE_NAME = "oroos_session";
const SESSION_DAYS = 7;

function secretKey(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    "openrecruitos-dev-secret-change-me-in-production";
  if (
    process.env.NODE_ENV === "production" &&
    (secret.length < 16 || /change-me/i.test(secret)) &&
    process.env.ALLOW_INSECURE_SECRET !== "true"
  ) {
    throw new Error("JWT_SECRET is not set to a strong random value. Set JWT_SECRET (at least 16 characters) before running in production.");
  }
  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "recruiter";
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function getSessionUserFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true },
    });
    return user ? { ...user, role: user.role === "admin" ? "admin" : "recruiter" } : null;
  } catch {
    return null;
  }
}

/** Old databases have no admin: promote the oldest account so someone can manage users. */
export async function ensureAdminExists(): Promise<void> {
  const admins = await db.user.count({ where: { role: "admin" } });
  if (admins > 0) return;
  const first = await db.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (first) await db.user.update({ where: { id: first.id }, data: { role: "admin" } });
}

/** Read the session from a NextRequest cookie jar (API routes). */
export async function getAuthUser(req: Request): Promise<SessionUser | null> {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  const token = match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : undefined;
  return getSessionUserFromToken(token);
}

/** Build the Set-Cookie header value. `Secure` is added automatically on HTTPS (or COOKIE_SECURE=true/false to force). */
export function sessionCookieHeader(req: Request, token: string | null): string {
  const env = process.env.COOKIE_SECURE;
  const https =
    env === "true" ||
    (env !== "false" &&
      (req.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https" || new URL(req.url).protocol === "https:"));
  const value = token === null ? "" : encodeURIComponent(token);
  const maxAge = token === null ? 0 : SESSION_COOKIE.options.maxAge;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${https ? "; Secure" : ""}`;
}

export const SESSION_COOKIE = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false, // set true behind HTTPS in production
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  },
};
