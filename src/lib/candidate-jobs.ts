// Server-only: what a signed-in candidate may see and do about jobs.

import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { parseCustomData } from "@/lib/candidate-fields";
import { loadFields } from "@/lib/candidate-custom";
import { evaluateRequirements, parseRequirements, RequirementResult } from "@/lib/job-requirements";

export async function getMaxApplications(): Promise<number> {
  try {
    const row = await db.organization.findUnique({ where: { id: "org" }, select: { maxApplications: true } });
    return Math.max(0, row?.maxApplications ?? 0);
  } catch {
    return 0;
  }
}

/** The signed-in candidate's profile; only candidates who have submitted a profile can use the jobs area. */
export async function requireProfile(candidateId: string | null) {
  if (!candidateId) throw new ApiError(403, "Submit your profile first to see the jobs");
  const candidate = await db.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) throw new ApiError(403, "Submit your profile first to see the jobs");
  return candidate;
}

export type Quota = { max: number; used: number; remaining: number | null };

export async function quotaOf(candidateId: string): Promise<Quota> {
  const [max, used] = await Promise.all([getMaxApplications(), db.application.count({ where: { candidateId } })]);
  return { max, used, remaining: max > 0 ? Math.max(0, max - used) : null };
}

/** Requirement results of one job for this candidate (all rules, with whether each is met). */
export async function checkJob(job: { requirements: string }, candidate: { customData: string } & Record<string, unknown>): Promise<RequirementResult[]> {
  const rules = parseRequirements(job.requirements);
  if (rules.length === 0) return [];
  return evaluateRequirements(rules, candidate, parseCustomData(candidate.customData), await loadFields());
}
