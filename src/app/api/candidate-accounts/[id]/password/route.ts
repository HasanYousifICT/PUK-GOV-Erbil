import { db } from "@/lib/db";
import { ApiError, handle, json, requireLevel } from "@/lib/api";
import { openPassword } from "@/lib/vault";

type Params = { params: Promise<{ id: string }> };

/** GET /api/candidate-accounts/:id/password — staff with edit access: the candidate's current password (if known). */
export async function GET(req: Request, { params }: Params) {
  return handle(async () => {
    await requireLevel(req, "access", "edit");
    const { id } = await params;
    const account = await db.candidateAccount.findUnique({ where: { id } });
    if (!account) throw new ApiError(404, "Candidate access not found");
    const res = json({ password: openPassword(account.passwordVault) });
    res.headers.set("Cache-Control", "no-store");
    return res;
  });
}
