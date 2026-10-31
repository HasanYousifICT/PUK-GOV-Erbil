// Applicant strength: an admin picks profile fields once (no points); for every job the applicants are ranked
// against each other on those fields. Shared by the server and the screens.

import { CandidateField, CustomData, CustomValue, isEmptyValue, isFileValue, isTableValue, withCalculated } from "@/lib/candidate-fields";

/** "high": a bigger value / later option / "yes" / filled is stronger. "low": the opposite. */
export type StrengthDir = "high" | "low";
export type StrengthFieldRule = {
  fieldId: string;
  dir: StrengthDir;
  /** dropdown / multi-select: the options from strongest to weakest, chosen by the admin (replaces `dir`) */
  order?: string[];
  /** multi-select: rank by how many are ticked, or by the best option ticked (uses `order`) */
  by?: "count" | "best";
};

/** "priority": the first field weighs the most, the last the least. "equal": every field counts the same (average). */
export type StrengthMode = "priority" | "equal";

export type StrengthConfig = {
  fields: StrengthFieldRule[];
  mode: StrengthMode;
  /** score from which an applicant is "Strong" / "Medium" (below mediumMin it is "Weak") */
  strongMin: number;
  mediumMin: number;
};

export type StrengthLevel = "strong" | "medium" | "weak";

export const DEFAULT_STRONG_MIN = 70;
export const DEFAULT_MEDIUM_MIN = 40;
export const MAX_STRENGTH_FIELDS = 20;

const clampInt = (n: unknown, lo: number, hi: number, d: number) => {
  const v = typeof n === "number" ? n : typeof n === "string" && n.trim() !== "" ? Number(n) : NaN;
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
};

/** Read the stored JSON (or an object from the client) into a clean setup. Never throws. An old points-based setup is ignored. */
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
  const seen = new Set<string>();
  const fields: StrengthFieldRule[] = [];
  if (Array.isArray(r.fields)) {
    for (const x of r.fields) {
      const f = x as Record<string, unknown> | null;
      if (!f || typeof f.fieldId !== "string" || !f.fieldId || seen.has(f.fieldId)) continue;
      seen.add(f.fieldId);
      const rule: StrengthFieldRule = { fieldId: f.fieldId, dir: f.dir === "low" ? "low" : "high" };
      if (Array.isArray(f.order)) {
        const order = [...new Set(f.order.filter((x): x is string => typeof x === "string" && x !== ""))].slice(0, 1000);
        if (order.length) rule.order = order;
      }
      if (f.by === "best") rule.by = "best";
      fields.push(rule);
      if (fields.length >= MAX_STRENGTH_FIELDS) break;
    }
  }
  let strongMin = clampInt(r.strongMin, 2, 100, DEFAULT_STRONG_MIN);
  let mediumMin = clampInt(r.mediumMin, 1, 99, DEFAULT_MEDIUM_MIN);
  if (mediumMin >= strongMin) mediumMin = Math.max(1, strongMin - 1);
  if (strongMin <= mediumMin) strongMin = mediumMin + 1;
  return { fields, mode: r.mode === "equal" ? "equal" : "priority", strongMin, mediumMin };
}

export const strengthEnabled = (c: StrengthConfig | null | undefined): boolean => !!c && c.fields.length > 0;

export function levelOf(score: number, cfg: Pick<StrengthConfig, "strongMin" | "mediumMin">): StrengthLevel {
  return score >= cfg.strongMin ? "strong" : score >= cfg.mediumMin ? "medium" : "weak";
}

/**
 * The options from strongest to weakest: the admin's order (options deleted since are dropped), then any option
 * that is not in it yet at the end. Without an order: the field's option list, reversed when "low" is stronger.
 */
export function effectiveOrder(field: Pick<CandidateField, "options">, rule: Pick<StrengthFieldRule, "dir" | "order">): string[] {
  if (rule.order) {
    const known = new Set(field.options);
    const o = rule.order.filter((x) => known.has(x));
    for (const x of field.options) if (!o.includes(x)) o.push(x);
    return o;
  }
  return rule.dir === "high" ? [...field.options].reverse() : [...field.options];
}

/**
 * How "big" an answer is, for ranking. null = nothing answered (always ranks last).
 * dropdown: position in the option list (later = bigger) · number · date · yes/no (yes = 1) ·
 * multi-select / table: how many ticked / rows · text / file: filled = 1.
 */
export function strengthKey(field: CandidateField, v: CustomValue | undefined, rule?: StrengthFieldRule): number | null {
  if (isEmptyValue(v)) return null;
  switch (field.type) {
    case "select": {
      if (rule?.order) {
        const o = effectiveOrder(field, rule);
        const i = o.indexOf(String(v));
        return i < 0 ? -1 : o.length - 1 - i; // strongest first in the list → biggest key
      }
      const i = field.options.indexOf(String(v));
      return i; // an answer no longer in the list (-1) ranks below every listed option
    }
    case "number": {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    }
    case "date": {
      const t = typeof v === "string" ? Date.parse(v) : NaN;
      return Number.isFinite(t) ? t : null;
    }
    case "yesno":
      return v === "yes" ? 1 : 0;
    case "multiselect": {
      if (!Array.isArray(v)) return 1;
      if (rule?.by === "best") {
        const o = effectiveOrder(field, rule);
        let best = -1;
        for (const x of v) {
          const i = o.indexOf(String(x));
          if (i >= 0) best = Math.max(best, o.length - 1 - i);
        }
        return best;
      }
      return v.length;
    }
    case "table":
      return isTableValue(v) ? v.rows.length : 0;
    case "file":
      return isFileValue(v) ? 1 : null;
    default:
      return 1;
  }
}

export type StrengthPart = {
  fieldId: string;
  /** the applicant's own answer is empty */
  empty: boolean;
  /** 1 = best answer of the job's applicants … N = worst (ties share a position) */
  position: number;
  /** applicants of the job */
  of: number;
  /** 0-100 share of the other applicants this one is ahead of (ties count half) */
  rank: number;
};

export type StrengthRow = { id: string; customData: CustomData };

/**
 * Score every applicant of ONE job, 0-100. Per field an applicant gets full credit for the best answer (ties for the
 * best answer all get full credit) and less the more applicants answered better. The fields are then averaged:
 * "priority" gives the first field the biggest share (k, k-1 … 1), "equal" the same share to each. Applicants who are
 * identical on every chosen field (or a lone applicant) are neutral: 50.
 */
export function scoreApplicants(
  cfg: StrengthConfig,
  fields: CandidateField[],
  rows: StrengthRow[]
): Map<string, { score: number; parts: StrengthPart[] }> {
  const out = new Map<string, { score: number; parts: StrengthPart[] }>();
  const n = rows.length;
  if (n === 0) return out;
  const byId = new Map(fields.map((f) => [f.id, f]));
  const rules = cfg.fields.filter((r) => byId.has(r.fieldId));
  const data = rows.map((r) => withCalculated(fields, r.customData));
  const per = rows.map(() => [] as StrengthPart[]);
  const share = rows.map(() => [] as number[]);
  const tuples = rows.map(() => [] as number[]);

  for (const rule of rules) {
    const field = byId.get(rule.fieldId)!;
    // with an admin order (dropdown, or multi-select by best option) the order already says which is stronger
    const ordered = (field.type === "select" && !!rule.order) || (field.type === "multiselect" && rule.by === "best");
    const sign = !ordered && rule.dir === "low" ? -1 : 1;
    // empty answers are always the worst, whichever direction is chosen
    const keys = data.map((d) => {
      const k = strengthKey(field, d[rule.fieldId], rule);
      return k === null ? -Infinity : k * sign;
    });
    keys.forEach((k, i) => {
      tuples[i].push(k);
      const position = 1 + keys.filter((x) => x > k).length; // 1 = nobody answered better
      const sc = n === 1 ? 0.5 : (n - position) / (n - 1);
      share[i].push(sc);
      per[i].push({ fieldId: rule.fieldId, empty: k === -Infinity, position, of: n, rank: Math.round(sc * 100) });
    });
  }

  const k = rules.length;
  const weights = rules.map((_, idx) => (cfg.mode === "equal" ? 1 : k - idx));
  const wTotal = weights.reduce((a, b) => a + b, 0);
  const identical = tuples.every((tp) => tp.every((v, j) => v === tuples[0][j]));
  rows.forEach((r, i) => {
    const score = !k ? 0 : identical ? 50 : Math.round((share[i].reduce((a, v, j) => a + v * weights[j], 0) / wTotal) * 100);
    out.set(r.id, { score, parts: per[i] });
  });
  return out;
}
