// Interviews can have several interviewers; the rule says whether all of them or just one must interview the candidate.

export const MAX_INTERVIEWERS = 5;

export function parseIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (typeof raw !== "string" || !raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** The interviewers that still have to interview, given the rule. true = the interview requirement is met. */
export function interviewDone(requireAll: boolean, interviewerIds: string[], doneIds: string[]): boolean {
  const done = interviewerIds.filter((id) => doneIds.includes(id));
  if (interviewerIds.length === 0) return false;
  return requireAll ? done.length === interviewerIds.length : done.length >= 1;
}

export type Evaluation = { comment: string; suitable: boolean; rating: number | null; at: string };

export function parseEvaluations(raw: unknown): Record<string, Evaluation> {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, Evaluation> = {};
  for (const [id, e] of Object.entries(v as Record<string, unknown>)) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    out[id] = {
      comment: typeof o.comment === "string" ? o.comment : "",
      suitable: o.suitable === true,
      rating: typeof o.rating === "number" ? o.rating : null,
      at: typeof o.at === "string" ? o.at : "",
    };
  }
  return out;
}
