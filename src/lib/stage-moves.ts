// Which pipeline moves a user may make. Empty / null = every move (the default, and always for administrators).

import { STAGES, REJECTED_STAGE } from "@/lib/constants";

export const STEP_KEYS = STAGES.slice(0, -1).map((s, i) => `${s}>${STAGES[i + 1]}`); // Applied>Screening, ...
export const REJECT_KEY = "reject";
export const BACK_KEY = "back";
export const ALL_MOVE_KEYS = [...STEP_KEYS, REJECT_KEY, BACK_KEY];

/** Clean list of known keys. Returns null (= everything allowed) when nothing valid is stored. */
export function parseMoves(raw: unknown): string[] | null {
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
  return [...new Set(v.filter((k): k is string => typeof k === "string" && ALL_MOVE_KEYS.includes(k)))];
}

/** Every step between two stages (forward) must be allowed; Rejected needs "reject"; going back (or out of Rejected) needs "back". */
export function canMove(allowed: string[] | null, role: string, from: string, to: string): boolean {
  if (role === "admin" || allowed === null) return true;
  if (from === to) return true;
  if (to === REJECTED_STAGE) return allowed.includes(REJECT_KEY);
  const order = STAGES as readonly string[];
  const a = from === REJECTED_STAGE ? -1 : order.indexOf(from);
  const b = order.indexOf(to);
  if (b < 0) return false;
  if (from === REJECTED_STAGE || b < a) return allowed.includes(BACK_KEY);
  for (let i = a; i < b; i++) if (!allowed.includes(`${order[i]}>${order[i + 1]}`)) return false;
  return true;
}
