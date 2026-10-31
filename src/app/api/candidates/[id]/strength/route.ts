import { ApiError, handle, json, requireAuth } from "@/lib/api";
import { can } from "@/lib/permissions";
import { explainStrength } from "@/lib/strength-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/candidates/:id/strength — the score of one candidate and which conditions are met. */
export async function GET(req: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireAuth(req);
    if (!can(user.permissions, "candidates", "view") && !can(user.permissions, "applications", "view")) throw new ApiError(403, "You do not have access to this");
    const { id } = await params;
    const r = await explainStrength(id);
    if (!r) throw new ApiError(404, "Candidate not found");
    return json(r);
  });
}
