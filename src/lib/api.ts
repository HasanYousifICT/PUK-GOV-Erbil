// OpenRecruitOS — API route helpers (auth guard + JSON responses)

import { getAuthUser, SessionUser } from "@/lib/auth";
import { Area, Level, levelAtLeast } from "@/lib/permissions";

export class ApiError extends Error {
  /** `extra` is sent to the browser next to the message (for example the id of a duplicate record). */
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

/** Throws a 401 Response when the request has no valid session. */
export async function requireAuth(req: Request): Promise<SessionUser> {
  const user = await getAuthUser(req);
  if (!user) throw new ApiError(401, "Unauthorized");
  return user;
}

export async function getAuthUserOrNull(req: Request): Promise<SessionUser | null> {
  return getAuthUser(req);
}

/** Like requireAuth, but only for administrators (403 otherwise). */
export async function requireAdmin(req: Request): Promise<SessionUser> {
  const user = await requireAuth(req);
  if (user.role !== "admin") throw new ApiError(403, "Only an administrator can do this");
  return user;
}

/** Signed in and allowed to `view` or `edit` an area (administrators always are). */
export async function requireLevel(req: Request, area: Area, need: Level): Promise<SessionUser> {
  const user = await requireAuth(req);
  if (!levelAtLeast(user.permissions[area], need)) {
    throw new ApiError(403, need === "edit" ? "You do not have permission to change this" : "You do not have permission to open this");
  }
  return user;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return Response.json({ ...err.extra, error: err.message }, { status: err.status });
    }
    console.error("[api]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}

export function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
