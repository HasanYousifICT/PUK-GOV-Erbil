import { db } from "@/lib/db";
import { handle, json, readJson, requireLevel } from "@/lib/api";
import { parseCustomData } from "@/lib/candidate-fields";
import { loadFields } from "@/lib/candidate-custom";
import { evaluateRequirements, parseRequirements } from "@/lib/job-requirements";
import { normalizeRequirements } from "@/lib/job-requirements-server";

export const dynamic = "force-dynamic";

const BATCH = 500;
const SCAN_LIMIT = 20000;

/**
 * POST /api/jobs/requirements-preview { requirements } — how many candidates would meet these requirements
 * (all of them, and each rule on its own). Shown while a job is being edited.
 */
export async function POST(req: Request) {
  return handle(async () => {
    await requireLevel(req, "jobs", "edit");
    const body = await readJson<{ requirements?: unknown }>(req);
    const rules = parseRequirements(await normalizeRequirements(body.requirements));
    const fields = await loadFields();

    let total = 0;
    let matching = 0;
    const perRule = rules.map(() => 0);
    let cursor: string | undefined;
    let truncated = false;
    for (;;) {
      const batch = await db.candidate.findMany({
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, name: true, code: true, email: true, phone: true, location: true, tags: true, notes: true, customData: true },
      });
      if (!batch.length) break;
      cursor = batch[batch.length - 1].id;
      for (const c of batch) {
        total++;
        if (rules.length === 0) {
          matching++;
          continue;
        }
        const results = evaluateRequirements(rules, c as unknown as Record<string, unknown>, parseCustomData(c.customData), fields);
        let all = true;
        rules.forEach((rule, i) => {
          const r = results.find((x) => x.rule === rule);
          if (!r) return; // the field no longer exists: the rule is ignored
          if (r.met) perRule[i]++;
          else all = false;
        });
        if (all) matching++;
      }
      if (batch.length < BATCH) break;
      if (total >= SCAN_LIMIT) {
        truncated = true;
        break;
      }
    }
    return json({ total, matching, perRule, truncated });
  });
}
