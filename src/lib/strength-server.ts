// Server side of the applicant strength: the saved setup, ranking the applicants of a job, and the explanation of one score.

import { db } from "@/lib/db";
import { loadFields } from "@/lib/candidate-custom";
import { displayValue, parseCustomData, CandidateField } from "@/lib/candidate-fields";
import { ApiError } from "@/lib/api";
import { levelOf, parseStrengthConfig, scoreApplicants, StrengthConfig, StrengthFieldRule, StrengthLevel, StrengthPart, weightsComplete } from "@/lib/strength";

export async function loadStrengthConfig(): Promise<StrengthConfig> {
  try {
    const row = await db.organization.findUnique({ where: { id: "org" }, select: { strengthConfig: true } });
    return parseStrengthConfig(row?.strengthConfig ?? "");
  } catch {
    return parseStrengthConfig("");
  }
}

/** Known fields only, every percentage above 0, and the percentages add up to 100. Throws a 400 otherwise. */
async function cleanFields(input: unknown): Promise<{ parsed: StrengthConfig; fields: StrengthFieldRule[] }> {
  const parsed = parseStrengthConfig(input);
  const known = new Set((await loadFields()).map((f) => f.id));
  const fields = parsed.fields.filter((f) => known.has(f.fieldId));
  if (fields.length && (fields.some((f) => !(f.weight > 0)) || !weightsComplete(fields))) {
    throw new ApiError(400, "The percentages of the fields must add up to 100%");
  }
  return { parsed, fields };
}

/** Store the general setup. */
export async function saveStrengthConfig(input: unknown): Promise<StrengthConfig> {
  const { parsed, fields } = await cleanFields(input);
  const cfg = { ...parsed, fields };
  await db.organization.upsert({
    where: { id: "org" },
    create: { id: "org", name: "OpenRecruitOS", strengthConfig: JSON.stringify(cfg) },
    update: { strengthConfig: JSON.stringify(cfg) },
  });
  return cfg;
}

/** The text stored on a job: its own list of fields, or "" (= follows the general setup). `input`: null / [] / {fields}. */
export async function normalizeJobStrength(input: unknown): Promise<string> {
  const raw = Array.isArray(input) ? { fields: input } : input;
  if (!raw || typeof raw !== "object") return "";
  const { fields } = await cleanFields(raw);
  return fields.length ? JSON.stringify({ fields }) : "";
}

/** The fields a job ranks by: its own when it has them, else the general ones. */
export function effectiveFields(general: StrengthConfig, jobRaw: string | null | undefined): { fields: StrengthFieldRule[]; own: boolean } {
  if (jobRaw) {
    const own = parseStrengthConfig(jobRaw).fields;
    if (own.length) return { fields: own, own: true };
  }
  return { fields: general.fields, own: false };
}

type Loaded = { id: string; strength: number; candidate: { customData: string } };

const APP_SELECT = { id: true, strength: true, candidate: { select: { customData: true } } } as const;

/** Rank the applicants of one job and save the changed scores. Returns every score (for the summary). */
async function rankJob(jobId: string, general: StrengthConfig, fields: CandidateField[], jobRaw?: string | null): Promise<{ scores: number[]; updated: number }> {
  if (jobRaw === undefined) jobRaw = (await db.job.findUnique({ where: { id: jobId }, select: { strengthConfig: true } }))?.strengthConfig ?? "";
  const eff = effectiveFields(general, jobRaw);
  const apps = (await db.application.findMany({ where: { jobId }, select: APP_SELECT })) as unknown as Loaded[];
  const scored = eff.fields.length ? scoreApplicants({ fields: eff.fields }, fields, apps.map((a) => ({ id: a.id, customData: parseCustomData(a.candidate?.customData) }))) : null;
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
    await rankJob(jobId, await loadStrengthConfig(), await loadFields());
  } catch {
    // ignore
  }
}

/** Re-rank every job the candidate applied to (their profile changed). Never throws. */
export async function refreshCandidateStrength(candidateId: string): Promise<void> {
  try {
    const cfg = await loadStrengthConfig();
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
  const jobs = await db.job.findMany({ select: { id: true, strengthConfig: true } });
  for (const j of jobs) {
    const r = await rankJob(j.id, cfg, fields, j.strengthConfig ?? "");
    updated += r.updated;
    total += r.scores.length;
    for (const s of r.scores) levels[levelOf(s, cfg)]++;
  }
  return { updated, total, levels };
}

export type StrengthItem = StrengthPart & { label: string; labelCkb: string; fieldType: string; dir: "high" | "low"; weight: number; value: string };

/** The score of one application with, per chosen field, its answer and its place among the job's applicants. */
export async function explainStrength(applicationId: string) {
  const cfg = await loadStrengthConfig();
  const app = await db.application.findUnique({ where: { id: applicationId }, select: { id: true, jobId: true, strength: true, job: { select: { title: true, strengthConfig: true } }, candidate: { select: { customData: true } } } });
  if (!app) return null;
  const base = { strongMin: cfg.strongMin, mediumMin: cfg.mediumMin };
  const job = (app as unknown as { job?: { title?: string; strengthConfig?: string } }).job;
  const eff = effectiveFields(cfg, job?.strengthConfig);
  if (!eff.fields.length) return { enabled: false as const, score: 0, level: "weak" as StrengthLevel, applicants: 0, jobTitle: "", custom: false, items: [] as StrengthItem[], ...base };
  const fields = await loadFields();
  const apps = (await db.application.findMany({ where: { jobId: app.jobId }, select: APP_SELECT })) as unknown as Loaded[];
  const scored = scoreApplicants({ fields: eff.fields }, fields, apps.map((a) => ({ id: a.id, customData: parseCustomData(a.candidate?.customData) })));
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
      dir: eff.fields.find((r) => r.fieldId === p.fieldId)?.dir ?? "high",
      weight: eff.fields.find((r) => r.fieldId === p.fieldId)?.weight ?? 0,
      value: displayValue(own[p.fieldId]),
    };
  });
  return { enabled: true as const, score, level: levelOf(score, cfg), applicants: apps.length, jobTitle: job?.title ?? "", custom: eff.own, items, ...base };
}

/** Jobs that have their own setup (for Settings → Candidate strength). */
export async function listModifiedJobs() {
  const jobs = await db.job.findMany({ where: { strengthConfig: { not: "" } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, title: true, status: true, location: true, strengthConfig: true, _count: { select: { applications: true } } }, take: 500 });
  return jobs
    .map((j) => ({ id: j.id, title: j.title, status: j.status, location: j.location, applications: j._count?.applications ?? 0, fields: parseStrengthConfig(j.strengthConfig).fields }))
    .filter((j) => j.fields.length > 0);
}

export async function countModifiedJobs(): Promise<number> {
  try {
    return await db.job.count({ where: { strengthConfig: { not: "" } } });
  } catch {
    return 0;
  }
}
