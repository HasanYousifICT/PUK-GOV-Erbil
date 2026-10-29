// Server-only: create notifications. A failure here must never break the action that caused it.

import { db } from "@/lib/db";
import { resolvePermissions, Area } from "@/lib/permissions";

type Params = Record<string, string | number | boolean | null | undefined>;

async function create(recipientKind: "user" | "candidate", ids: string[], type: string, params: Params, link: Record<string, unknown> | null) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return;
  try {
    await db.notification.createMany({
      data: unique.map((recipientId) => ({ recipientKind, recipientId, type, params: JSON.stringify(params), link: link ? JSON.stringify(link) : "" })),
    });
  } catch (e) {
    console.error("[notify]", e);
  }
}

export const notifyUsers = (ids: string[], type: string, params: Params, link: Record<string, unknown> | null = null) => create("user", ids, type, params, link);
export const notifyCandidate = (candidateId: string | null | undefined, type: string, params: Params, link: Record<string, unknown> | null = null) =>
  candidateId ? create("candidate", [candidateId], type, params, link) : Promise.resolve();

/** Active users who may edit an area (administrators included). */
export async function usersWith(area: Area): Promise<string[]> {
  try {
    const users = await db.user.findMany({ where: { active: true }, select: { id: true, role: true, permissions: true } });
    return users.filter((u) => resolvePermissions(u.role, u.permissions)[area] === "edit").map((u) => u.id);
  } catch {
    return [];
  }
}

/** Application → the facts every message needs. */
export async function applicationFacts(applicationId: string) {
  try {
    const a = await db.application.findUnique({
      where: { id: applicationId },
      select: { id: true, candidateId: true, candidate: { select: { name: true } }, job: { select: { title: true } } },
    });
    return a ? { applicationId: a.id, candidateId: a.candidateId, candidate: a.candidate.name, job: a.job.title } : null;
  } catch {
    return null;
  }
}
