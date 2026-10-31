// Candidate profile strength: an admin picks conditions on the candidate profile once (each worth some points);
// a candidate's score is the share of points earned, 0-100. Shared by the server and the screens.

import { CandidateField, CustomData } from "@/lib/candidate-fields";
import { CustomFilter } from "@/lib/candidate-filters";
import { evaluateRequirements, parseRequirements, RequirementResult } from "@/lib/job-requirements";

export type StrengthConfig = {
  rules: CustomFilter[];
  /** score from which a profile is "Strong" / "Medium" (below mediumMin it is "Weak") */
  strongMin: number;
  mediumMin: number;
};

export type StrengthLevel = "strong" | "medium" | "weak";

export const DEFAULT_WEIGHT = 10;
export const DEFAULT_STRONG_MIN = 70;
export const DEFAULT_MEDIUM_MIN = 40;

const clampInt = (n: unknown, lo: number, hi: number, d: number) => {
  const v = typeof n === "number" ? n : typeof n === "string" && n.trim() !== "" ? Number(n) : NaN;
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
};

/** Read the stored JSON (or an object from the client) into a clean setup. Never throws. */
export function parseStrengthConfig(raw: unknown): StrengthConfig {
  let o: unknown = raw;
  if (typeof raw === "string") {
    try {
      o = JSON.parse(raw || "{}");
    } catch {
      o = {};
    }
  }
  const r = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
  const rules = parseRequirements(r.rules ?? []).map((x) => ({ ...x, weight: x.weight ?? DEFAULT_WEIGHT }));
  let strongMin = clampInt(r.strongMin, 2, 100, DEFAULT_STRONG_MIN);
  let mediumMin = clampInt(r.mediumMin, 1, 99, DEFAULT_MEDIUM_MIN);
  if (mediumMin >= strongMin) mediumMin = Math.max(1, strongMin - 1);
  if (strongMin <= mediumMin) strongMin = mediumMin + 1;
  return { rules, strongMin, mediumMin };
}

export const strengthEnabled = (c: StrengthConfig | null | undefined): boolean => !!c && c.rules.length > 0;

export const weightOf = (rule: CustomFilter): number => clampInt(rule.weight, 1, 100, DEFAULT_WEIGHT);

/** 0-100: the points of the conditions the candidate meets, out of all points. */
export function scoreOf(results: Pick<RequirementResult, "rule" | "met">[]): number {
  let total = 0;
  let earned = 0;
  for (const r of results) {
    const w = weightOf(r.rule);
    total += w;
    if (r.met) earned += w;
  }
  return total > 0 ? Math.round((earned / total) * 100) : 0;
}

export function levelOf(score: number, cfg: Pick<StrengthConfig, "strongMin" | "mediumMin">): StrengthLevel {
  return score >= cfg.strongMin ? "strong" : score >= cfg.mediumMin ? "medium" : "weak";
}

/** Score one candidate (built-in columns + profile answers; ages are recalculated from today). */
export function scoreCandidate(
  cfg: StrengthConfig,
  candidate: Record<string, unknown>,
  customData: CustomData,
  fields: CandidateField[]
): { score: number; results: RequirementResult[] } {
  if (!strengthEnabled(cfg)) return { score: 0, results: [] };
  const results = evaluateRequirements(cfg.rules, candidate, customData, fields);
  return { score: scoreOf(results), results };
}
