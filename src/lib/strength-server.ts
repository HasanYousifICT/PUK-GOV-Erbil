// Server side of the applicant strength: the saved setup, ranking the applicants of a job, and the explanation of one score.

import { db } from "@/lib/db";
import { loadFields } from "@/lib/candidate-custom";
import { displayValue, parseCustomData, CandidateField } from "@/lib/candidate-fields";
import { levelOf, parseStrengthConfig, scoreApplicants, strengthEnabled, StrengthConfig, StrengthLevel, StrengthPart } from "@/lib/strength";

export async function loadStrengthConfig(): Promise<StrengthConfig> {
  try {
    const row = await db.organization.findUnique({ where: { id: "org" }, select: { strengthConfig: true } });
    return parseStrengthConfig(row?.strengthConfig ?? "");
  } catch {
    return parseStrengthConfig("");
  }
}

/** Keep only fields that exist, then store. */
export async function saveStrengthConfig(input: unknown): Promise<StrengthConfig> {
  const parsed = parseStrengthConfig(input);
  const known = new Set((await loadFields()).map((f) => f.id));
  const cfg = { ...parsed, fields: parsed.fields.filter((f) => known.has(f.fieldId)) };
  await db.organization.upsert({
    where: { id: "org" },
    create: { id: "org", name: "OpenRecruitOS", strengthConfig: JSON.stringify(cfg) },
    update: { strengthConfig: JSON.stringify(cfg) },
  });
  return cfg;
}

type Loaded = { id: string; strength: number; candidate: { customData: string } };

const APP_SELECT = { id: true, strength: true, candidate: { select: { customData: true } } } as const;

/** Rank the applicants of one job and save the changed scores. Returns every score (for the summary). */
async function rankJob(jobId: string, cfg: StrengthConfig, fields: CandidateField[]): Promise<{ scores: number[]; updated: number }> {
  const apps = (await db.application.findMany({ where: { jobId }, select: APP_SELECT })) as unknown as Loaded[];
  const scored = strengthEnabled(cfg) ? scoreApplicants(cfg, fields, apps.map((a) => ({ id: a.id, customData: parseCustomData(a.candidate?.customData) }))) : null;
  const changes = new Map<number, string[]>();
  const scores: number[] = [];
  for (const a of apps) {
    const s = scored?.get(a.id)?.score ?? 0;
    scores.push(s);
    if (s !== a.strength) changes.set(s, [...(changes.get(s) ?? []), a.id]);
  }
  let updated = 0;
  // at most 101 different scores: one update per score instead of one per applicant
  for (const [score, ids] of changes) {
    await db.application.updateMany({ where: { id: { in: ids } }, data: { strength: score } });
    updated += ids.length;
  }
  return { scores, updated };
}

/** Re-rank one job after an applicant joined, left or changed their profile. Never throws. */
export async function refreshJobStrength(jobId: string): Promise<void> {
  try {
    const cfg = await loadStrengthConfig();
    if (!strengthEnabled(cfg)) return;
    await rankJob(jobId, cfg, await loadFields());
  } catch {
    // ignore
  }
}

/** Re-rank every job the candidate applied to (their profile changed). Never throws. */
export async function refreshCandidateStrength(candidateId: string): Promise<void> {
  try {
    const cfg = await loadStrengthConfig();
    if (!strengthEnabled(cfg)) return;
    const apps = await db.application.findMany({ where: { candidateId }, select: { jobId: true } });
    const fields = await loadFields();
    for (const jobId of new Set(apps.map((a) => a.jobId))) await rankJob(jobId, cfg, fields);
  } catch {
    // ignore
  }
}

/** Re-rank everything (the setup changed). Returns how many scores changed and how many applicants are in each level. */
export async function recomputeAllStrength(cfg: StrengthConfig): Promise<{ updated: number; total: number; levels: Record<StrengthLevel, number> }> {
  const fields = await loadFields();
  const levels: Record<StrengthLevel, number> = { strong: 0, medium: 0, weak: 0 };
  let updated = 0;
  let total = 0;
  const jobs = await db.job.findMany({ select: { id: true } });
  for (const j of jobs) {
    const r = await rankJob(j.id, cfg, fields);
    updated += r.updated;
    total += r.scores.length;
    for (const s of r.scores) levels[levelOf(s, cfg)]++;
  }
  return { updated, total, levels };
}

export type StrengthItem = StrengthPart & { label: string; labelCkb: string; fieldType: string; dir: "high" | "low"; value: string };

/** The score of one application with, per chosen field, its answer and its place among the job's applicants. */
export async function explainStrength(applicationId: string) {
  const cfg = await loadStrengthConfig();
  const app = await db.application.findUnique({ where: { id: applicationId }, select: { id: true, jobId: true, strength: true, job: { select: { title: true } }, candidate: { select: { customData: true } } } });
  if (!app) return null;
  const base = { strongMin: cfg.strongMin, mediumMin: cfg.mediumMin };
  if (!strengthEnabled(cfg)) return { enabled: false as const, score: 0, level: "weak" as StrengthLevel, applicants: 0, jobTitle: "", items: [] as StrengthItem[], ...base };
  const fields = await loadFields();
  const apps = (await db.application.findMany({ where: { jobId: app.jobId }, select: APP_SELECT })) as unknown as Loaded[];
  const scored = scoreApplicants(cfg, fields, apps.map((a) => ({ id: a.id, customData: parseCustomData(a.candidate?.customData) })));
  const mine = scored.get(app.id);
  const own = parseCustomData(app.candidate?.customData);
  const score = mine?.score ?? 0;
  const items: StrengthItem[] = (mine?.parts ?? []).map((p) => {
    const f = fields.find((x) => x.id === p.fieldId)!;
    return {
      ...p,
      label: f.label,
      labelCkb: f.labelCkb,
      fieldType: f.type,
      dir: cfg.fields.find((r) => r.fieldId === p.fieldId)?.dir ?? "high",
      value: displayValue(own[p.fieldId]),
    };
  });
  return { enabled: true as const, score, level: levelOf(score, cfg), applicants: apps.length, jobTitle: (app as unknown as { job?: { title?: string } }).job?.title ?? "", items, ...base };
}
