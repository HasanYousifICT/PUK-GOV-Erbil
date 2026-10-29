// What a user with edit access to Interviews may do: schedule (create, change, cancel, delete) and/or give feedback (evaluations).
// Empty / null = both (the default, and always for administrators).

export const INTERVIEW_ACTIONS = ["schedule", "feedback"] as const;
export type InterviewAction = (typeof INTERVIEW_ACTIONS)[number];

export function parseActions(raw: unknown): string[] | null {
  let v: unknown = raw;
  if (typeof raw === "string") {
    if (!raw) return null;
    try {
      v = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(v)) return null;
  return [...new Set(v.filter((k): k is string => typeof k === "string" && (INTERVIEW_ACTIONS as readonly string[]).includes(k)))];
}

export function canDo(actions: string[] | null | undefined, role: string, action: InterviewAction): boolean {
  if (role === "admin" || actions === null || actions === undefined) return true;
  return actions.includes(action);
}
