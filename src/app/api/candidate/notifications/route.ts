import { handle, json, requireCandidate } from "@/lib/api-candidate";
import { listFor } from "@/lib/notify-list";

/** GET /api/candidate/notifications — the signed-in candidate's notifications (needs a submitted profile). */
export async function GET(req: Request) {
  return handle(async () => {
    const account = await requireCandidate(req);
    if (!account.candidateId) return json({ items: [], unread: 0 });
    return json(await listFor("candidate", account.candidateId));
  });
}
