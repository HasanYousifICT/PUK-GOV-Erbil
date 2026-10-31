import { handle, json, readJson, requireAdmin, requireAuth } from "@/lib/api";
import { loadStrengthConfig, recomputeAllStrength, saveStrengthConfig } from "@/lib/strength-server";

export const dynamic = "force-dynamic";

/** GET /api/strength-config — which profile fields rank the applicants (every signed-in user: the screens need it to label scores). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAuth(req);
    return json(await loadStrengthConfig());
  });
}

/** PUT /api/strength-config { fields:[{fieldId,dir}], strongMin, mediumMin } — administrators only. Saves and re-ranks every job. */
export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const config = await saveStrengthConfig(body);
    const result = await recomputeAllStrength(config);
    return json({ config, ...result });
  });
}
