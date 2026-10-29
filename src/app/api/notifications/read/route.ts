import { handle, json, readJson, requireAuth } from "@/lib/api";
import { markRead } from "@/lib/notify-list";

/** POST /api/notifications/read { ids?: string[], all?: true } */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireAuth(req);
    await markRead("user", user.id, await readJson<Record<string, unknown>>(req));
    return json({ ok: true });
  });
}
