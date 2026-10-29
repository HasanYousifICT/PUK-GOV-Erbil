import { canDo, parseActions } from "@/lib/interview-actions";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { resolvePermissions } from "@/lib/permissions";
import { Evaluation, interviewDone, MAX_INTERVIEWERS, parseIds } from "@/lib/interview-rules";

/** Check the chosen interviewer ids are active users with interview access; returns their names joined. */
export async function resolveInterviewers(input: unknown): Promise<{ ids: string[]; names: string }> {
  const ids = [...new Set(parseIds(input))];
  if (ids.length === 0) throw new ApiError(400, "Choose at least one interviewer");
  if (ids.length > MAX_INTERVIEWERS) throw new ApiError(400, "Too many interviewers (max 5)");
  const users = await db.user.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, name: true, role: true, permissions: true, interviewActions: true } });
  const ok = users.filter((u) => resolvePermissions(u.role, u.permissions).interviews === "edit" && canDo(parseActions(u.interviewActions), u.role, "feedback"));
  if (ok.length !== ids.length) throw new ApiError(400, "Choose interviewers from the list");
  return { ids, names: ids.map((id) => ok.find((u) => u.id === id)!.name).join(", ") };
}

/** Status after interviewers finish: Completed when the rule is met (unless cancelled), otherwise Scheduled. */
export function statusFor(current: string, requireAll: boolean, ids: string[], doneIds: string[]): string {
  if (current === "Cancelled") return current;
  return interviewDone(requireAll, ids, doneIds) ? "Completed" : "Scheduled";
}

/** One interviewer's evaluation from the request: whether the candidate is suitable, a 1–10 rating when suitable, and a comment. */
export function cleanEvaluation(input: unknown): Evaluation {
  if (!input || typeof input !== "object") throw new ApiError(400, "Invalid evaluation");
  const o = input as Record<string, unknown>;
  if (typeof o.suitable !== "boolean") throw new ApiError(400, "Choose whether the candidate is suitable");
  let rating: number | null = null;
  if (o.suitable) {
    const n = Number(o.rating);
    if (!Number.isInteger(n) || n < 1 || n > 10) throw new ApiError(400, "Give a rating from 1 to 10");
    rating = n;
  }
  const comment = typeof o.comment === "string" ? o.comment.trim().slice(0, 2000) : "";
  return { comment, suitable: o.suitable, rating, at: new Date().toISOString() };
}
