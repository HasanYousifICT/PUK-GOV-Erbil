import { handle, json, readJson, requireCandidate } from "@/lib/api-candidate";
import { markRead } from "@/lib/notify-list";

/** POST /api/candidate/notifications/read { ids?: string[], all?: true } */
export async function POST(req: Request) {
  return handle(async () => {
    const account = await requireCandidate(req);
    if (account.candidateId) await markRead("candidate", account.candidateId, await readJson<Record<string, unknown>>(req));
    return json({ ok: true });
  });
}
