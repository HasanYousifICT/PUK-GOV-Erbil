import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { resolvePermissions } from "@/lib/permissions";
import { interviewDone, MAX_INTERVIEWERS, parseIds } from "@/lib/interview-rules";

/** Check the chosen interviewer ids are active users with interview access; returns their names joined. */
export async function resolveInterviewers(input: unknown): Promise<{ ids: string[]; names: string }> {
  const ids = [...new Set(parseIds(input))];
  if (ids.length === 0) throw new ApiError(400, "Choose at least one interviewer");
  if (ids.length > MAX_INTERVIEWERS) throw new ApiError(400, "Too many interviewers (max 5)");
  const users = await db.user.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, name: true, role: true, permissions: true } });
  const ok = users.filter((u) => resolvePermissions(u.role, u.permissions).interviews === "edit");
  if (ok.length !== ids.length) throw new ApiError(400, "Choose interviewers from the list");
  return { ids, names: ids.map((id) => ok.find((u) => u.id === id)!.name).join(", ") };
}

/** Status after interviewers finish: Completed when the rule is met (unless cancelled), otherwise Scheduled. */
export function statusFor(current: string, requireAll: boolean, ids: string[], doneIds: string[]): string {
  if (current === "Cancelled") return current;
  return interviewDone(requireAll, ids, doneIds) ? "Completed" : "Scheduled";
}
