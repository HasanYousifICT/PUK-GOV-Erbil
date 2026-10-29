import { db } from "@/lib/db";
import { handle, json, requireLevel } from "@/lib/api";
import { resolvePermissions } from "@/lib/permissions";

/** GET /api/interviewers — active users who can run interviews (access to the Interviews area with edit rights). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireLevel(req, "interviews", "view");
    const users = await db.user.findMany({
      where: { active: true },
      select: { id: true, name: true, title: true, role: true, permissions: true },
      orderBy: { name: "asc" },
    });
    return json(
      users
        .filter((u) => resolvePermissions(u.role, u.permissions).interviews === "edit")
        .map((u) => ({ id: u.id, name: u.name, title: u.title }))
    );
  });
}
