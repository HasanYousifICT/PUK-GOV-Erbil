// Server-only: validate the requirements sent with a job.

import { ApiError } from "@/lib/api";
import { loadFields } from "@/lib/candidate-custom";
import { isStdField, STD_FIELDS, OPS_BY_TYPE, STD_OPS } from "@/lib/candidate-filters";
import { MAX_REQUIREMENTS, parseRequirements } from "@/lib/job-requirements";

/** Clean the rules from the client: known fields only, an operator that suits the field type. Returns the JSON to store. */
export async function normalizeRequirements(input: unknown): Promise<string> {
  if (input === undefined || input === null || input === "") return "[]";
  if (!Array.isArray(input)) throw new ApiError(400, "Invalid requirements");
  if (input.length > MAX_REQUIREMENTS) throw new ApiError(400, "Too many requirements (max 20)");
  const rules = parseRequirements(input);
  const fields = await loadFields();
  for (const r of rules) {
    if (isStdField(r.fieldId)) {
      if (!STD_FIELDS.some((x) => x.id === r.fieldId) || !STD_OPS.includes(r.op)) throw new ApiError(400, "Invalid requirement");
      continue;
    }
    const f = fields.find((x) => x.id === r.fieldId);
    if (!f || !OPS_BY_TYPE[f.type].includes(r.op)) throw new ApiError(400, "Invalid requirement");
  }
  return JSON.stringify(rules);
}
