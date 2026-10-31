// Server side of the candidate strength: the saved setup, recalculation and the explanation of one score.

import { db } from "@/lib/db";
import { loadFields } from "@/lib/candidate-custom";
import { parseCustomData } from "@/lib/candidate-fields";
import { normalizeRequirements } from "@/lib/job-requirements-server";
import { levelOf, parseStrengthConfig, scoreCandidate, strengthEnabled, StrengthConfig, StrengthLevel } from "@/lib/strength";

const COLUMNS = { id: true, name: true, code: true, email: true, phone: true, location: true, tags: true, notes: true, customData: true, strength: true } as const;
const BATCH = 500;

export async function loadStrengthConfig(): Promise<StrengthConfig> {
  try {
    const row = await db.organization.findUnique({ where: { id: "org" }, select: { strengthConfig: true } });
    return parseStrengthConfig(row?.strengthConfig ?? "");
  } catch {
    return parseStrengthConfig("");
  }
}

/** Validate what the admin sent (known fields, operators that suit the field) and store it. */
export async function saveStrengthConfig(input: unknown): Promise<StrengthConfig> {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const rulesJson = await normalizeRequirements(o.rules ?? []);
  const cfg = parseStrengthConfig({ ...o, rules: JSON.parse(rulesJson) });
  await db.organization.upsert({
    where: { id: "org" },
    create: { id: "org", name: "OpenRecruitOS", strengthConfig: JSON.stringify(cfg) },
    update: { strengthConfig: JSON.stringify(cfg) },
  });
  return cfg;
}

/** Recalculate one candidate. Never throws: a problem here must not break saving a profile. */
export async function refreshStrength(candidateId: string): Promise<void> {
  try {
    const cfg = await loadStrengthConfig();
    const c = await db.candidate.findUnique({ where: { id: candidateId }, select: COLUMNS });
    if (!c) return;
    const score = strengthEnabled(cfg) ? scoreCandidate(cfg, c as unknown as Record<string, unknown>, parseCustomData(c.customData), await loadFields()).score : 0;
    if (score !== c.strength) await db.candidate.update({ where: { id: candidateId }, data: { strength: score } });
  } catch {
    // ignore
  }
}

/** Recalculate everyone (after the setup changed). Returns how many scores changed and how many candidates are in each level. */
export async function recomputeAllStrength(cfg: StrengthConfig): Promise<{ updated: number; total: number; levels: Record<StrengthLevel, number> }> {
  const fields = strengthEnabled(cfg) ? await loadFields() : [];
  const levels: Record<StrengthLevel, number> = { strong: 0, medium: 0, weak: 0 };
  let updated = 0;
  let total = 0;
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.candidate.findMany({
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: COLUMNS,
    });
    if (!batch.length) break;
    cursor = batch[batch.length - 1].id;
    const changes = new Map<number, string[]>();
    for (const c of batch) {
      total++;
      const score = strengthEnabled(cfg) ? scoreCandidate(cfg, c as unknown as Record<string, unknown>, parseCustomData(c.customData), fields).score : 0;
      levels[levelOf(score, cfg)]++;
      if (score !== c.strength) changes.set(score, [...(changes.get(score) ?? []), c.id]);
    }
    // at most 101 different scores: one update per score instead of one per candidate
    for (const [score, ids] of changes) {
      await db.candidate.updateMany({ where: { id: { in: ids } }, data: { strength: score } });
      updated += ids.length;
    }
    if (batch.length < BATCH) break;
  }
  return { updated, total, levels };
}

export type StrengthItem = { fieldId: string; label: string; labelCkb: string; fieldType: string; rule: StrengthConfig["rules"][number]; met: boolean; weight: number };

/** The score of one candidate with every condition and whether it is met (for the detail screen). */
export async function explainStrength(candidateId: string) {
  const cfg = await loadStrengthConfig();
  const c = await db.candidate.findUnique({ where: { id: candidateId }, select: COLUMNS });
  if (!c) return null;
  if (!strengthEnabled(cfg)) return { enabled: false as const, score: 0, level: "weak" as StrengthLevel, strongMin: cfg.strongMin, mediumMin: cfg.mediumMin, items: [] as StrengthItem[] };
  const { score, results } = scoreCandidate(cfg, c as unknown as Record<string, unknown>, parseCustomData(c.customData), await loadFields());
  return {
    enabled: true as const,
    score,
    level: levelOf(score, cfg),
    strongMin: cfg.strongMin,
    mediumMin: cfg.mediumMin,
    items: results.map((r): StrengthItem => ({ fieldId: r.rule.fieldId, label: r.label, labelCkb: r.labelCkb, fieldType: r.fieldType, rule: r.rule, met: r.met, weight: r.rule.weight ?? 10 })),
  };
}
