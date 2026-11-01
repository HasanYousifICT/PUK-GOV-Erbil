import { handle, json, readJson, requireAdmin, requireAuth } from "@/lib/api";
import { countModifiedJobs, listModifiedJobs, loadStrengthConfig, recomputeAllStrength, saveStrengthConfig } from "@/lib/strength-server";

export const dynamic = "force-dynamic";

/** GET /api/strength-config — the general setup (every signed-in user: the screens need it to label scores). `modifiedJobs` = jobs with their own. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAuth(req);
    return json({ ...(await loadStrengthConfig()), modifiedJobs: await countModifiedJobs() });
  });
}

/** PUT /api/strength-config { fields:[{fieldId,dir,weight,…}], strongMin, mediumMin } — administrators only. Saves and re-ranks every job. */
export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const config = await saveStrengthConfig(body);
    const result = await recomputeAllStrength(config);
    return json({ config: { ...config, modifiedJobs: await countModifiedJobs() }, ...result, jobs: await listModifiedJobs() });
  });
}
