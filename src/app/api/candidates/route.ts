import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAuth, requireLevel, str } from "@/lib/api";
import { locationFromAnswers, parseCustomData, withCalculated } from "@/lib/candidate-fields";
import { CandidateFilters, CustomFilter, isCustomFilterActive, isStdField, matchesCustomFilter, matchesStdFilter } from "@/lib/candidate-filters";
import { isValidStage } from "@/lib/constants";
import { loadFields, validateCustomData } from "@/lib/candidate-custom";

/** Read the `filters` query parameter (JSON) into a clean filter object. */
function parseFilters(raw: string | null): CandidateFilters {
  if (!raw) return {};
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "Invalid filters");
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  const text = (x: unknown) => (typeof x === "string" ? x.trim().slice(0, 200) : "");
  const filters: CandidateFilters = {
    location: text(o.location) || undefined,
    skills: text(o.skills) || undefined,
    applied: o.applied === "none" || o.applied === "some" ? o.applied : undefined,
    jobId: text(o.jobId) || undefined,
    jobMode: o.jobMode === "notIn" ? "notIn" : "in",
    stage: text(o.stage) || undefined,
    resume: o.resume === "has" || o.resume === "none" ? o.resume : undefined,
    access: o.access === "has" || o.access === "none" ? o.access : undefined,
    from: /^\d{4}-\d{2}-\d{2}$/.test(text(o.from)) ? text(o.from) : undefined,
    to: /^\d{4}-\d{2}-\d{2}$/.test(text(o.to)) ? text(o.to) : undefined,
  };
  if (filters.stage && !isValidStage(filters.stage)) filters.stage = undefined;
  if (Array.isArray(o.custom)) {
    filters.custom = o.custom.slice(0, 20).flatMap((c): CustomFilter[] => {
      if (!c || typeof c !== "object") return [];
      const r = c as Record<string, unknown>;
      return [
        {
          fieldId: text(r.fieldId),
          op: text(r.op),
          value: typeof r.value === "string" ? r.value.slice(0, 200) : undefined,
          value2: typeof r.value2 === "string" ? r.value2.slice(0, 200) : undefined,
        },
      ];
    });
  }
  return filters;
}

const isSqlite = () => (process.env.DATABASE_URL ?? "file:").startsWith("file:");
/** Case-insensitive "contains" — SQLite LIKE already ignores ASCII case; PostgreSQL needs the mode. */
const has = (v: string) => (isSqlite() ? { contains: v } : { contains: v, mode: "insensitive" as const });

let accessBackfilled = false;
/** One-off: mark candidates that already have a login (older data created before the flag existed). */
async function backfillHasAccess() {
  if (accessBackfilled) return;
  accessBackfilled = true;
  try {
    await db.$executeRawUnsafe(
      `UPDATE "Candidate" SET "hasAccess" = ${isSqlite() ? "1" : "true"} WHERE "hasAccess" = ${isSqlite() ? "0" : "false"} AND "id" IN (SELECT "candidateId" FROM "CandidateAccount" WHERE "candidateId" IS NOT NULL)`
    );
  } catch {
    accessBackfilled = false;
  }
}

const LIGHT_OMIT = { notes: true, education: true, customData: true } as const;

/** GET /api/candidates?q=&filters=<json>&page=1&pageSize=50 — one page of candidates + total */
export async function GET(req: Request) {
  return handle(async () => {
    await requireLevel(req, "candidates", "view");
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const f = parseFilters(url.searchParams.get("filters"));
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "50", 10) || 50));

    const and: Prisma.CandidateWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { name: has(q) },
          { email: has(q) },
          { phone: has(q) },
          { skills: has(q) },
          { location: has(q) },
          { tags: has(q) },
          { code: has(q) },
        ],
      });
    }
    if (f.resume === "has") and.push({ resume: { not: "" } });
    if (f.resume === "none") and.push({ resume: "" });
    if (f.access) {
      await backfillHasAccess();
      and.push({ hasAccess: f.access === "has" });
    }
    if (f.from) and.push({ createdAt: { gte: new Date(`${f.from}T00:00:00.000Z`) } });
    if (f.to) and.push({ createdAt: { lte: new Date(`${f.to}T23:59:59.999Z`) } });
    if (f.location) and.push({ location: has(f.location) });
    if (f.skills) {
      for (const term of f.skills.split(",").map((x) => x.trim()).filter(Boolean)) and.push({ skills: has(term) });
    }

    if (f.jobId) {
      if (f.jobMode === "notIn") and.push({ applications: { none: { jobId: f.jobId } } });
      else and.push({ applications: { some: { jobId: f.jobId, ...(f.stage ? { stage: f.stage } : {}) } } });
    } else {
      if (f.applied === "none") and.push({ applications: { none: {} } });
      if (f.applied === "some" && !f.stage) and.push({ applications: { some: {} } });
      if (f.stage) and.push({ applications: { some: { stage: f.stage } } });
    }
    const where: Prisma.CandidateWhereInput | undefined = and.length ? { AND: and } : undefined;
    const orderBy: Prisma.CandidateOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];
    const counts = { _count: { select: { applications: true } } };

    const active = (f.custom ?? []).filter(isCustomFilterActive);
    const std = active.filter((c) => isStdField(c.fieldId));
    const custom = active.filter((c) => !isStdField(c.fieldId));
    let usable: CustomFilter[] = [];
    let byId = new Map<string, Awaited<ReturnType<typeof loadFields>>[number]>();
    if (custom.length) {
      byId = new Map((await loadFields()).map((x) => [x.id, x]));
      usable = custom.filter((c) => byId.has(c.fieldId));
    }

    // Fast path: everything was filtered in SQL, so just read one page.
    if (!std.length && !usable.length) {
      const [total, items] = await Promise.all([
        db.candidate.count({ where }),
        db.candidate.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, omit: LIGHT_OMIT, include: counts }),
      ]);
      return json({ items: await withAccess(items), total, page, pageSize });
    }

    // Slow path (filters on custom/profile fields stored as JSON): scan in batches, never loading everything at once.
    const from = (page - 1) * pageSize;
    const items: Awaited<ReturnType<typeof db.candidate.findMany>> = [];
    let total = 0;
    let cursor: string | undefined;
    for (;;) {
      const batch = await db.candidate.findMany({
        where,
        orderBy,
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: counts,
      });
      if (!batch.length) break;
      cursor = batch[batch.length - 1].id;
      for (const c of batch) {
        if (!std.every((flt) => matchesStdFilter(c as unknown as Record<string, unknown>, flt))) continue;
        if (usable.length) {
          const data = withCalculated([...byId.values()], parseCustomData(c.customData)); // ages as of today
          if (!usable.every((flt) => matchesCustomFilter(data, byId.get(flt.fieldId)!, flt))) continue;
        }
        if (total >= from && items.length < pageSize) {
          const { notes: _n, education: _e, customData: _c, ...light } = c;
          items.push(light as typeof c);
        }
        total++;
      }
      if (batch.length < 500) break;
    }
    return json({ items: await withAccess(items), total, page, pageSize });
  });
}

/** Adds `access` (the candidate's login, or null) to each candidate. */
async function withAccess<T extends { id: string }>(rows: T[]) {
  const accounts = rows.length
    ? await db.candidateAccount.findMany({
        where: { candidateId: { in: rows.map((r) => r.id) } },
        select: { id: true, candidateId: true, username: true, phone: true },
      })
    : [];
  const by = new Map(accounts.map((a) => [a.candidateId, { id: a.id, username: a.username, phone: a.phone ?? "" }]));
  return rows.map((r) => ({ ...r, access: by.get(r.id) ?? null }));
}

/** POST /api/candidates — create candidate (optionally referencing an uploaded resume key) */
function photoKey(v: unknown): string {
  const k = str(v);
  return k.startsWith("photos/") && !k.includes("..") ? k : "";
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireLevel(req, "candidates", "edit");
    const body = await readJson<Record<string, unknown>>(req);
    const name = str(body.name).trim();
    if (!name) throw new ApiError(400, "Candidate name is required");
    const email = str(body.email).trim();
    if (email) {
      const dup = await db.candidate.findFirst({ where: { email } });
      if (dup) throw new ApiError(409, "A candidate with this email already exists");
    }
    const fields = await loadFields();
    const { data: customData } = validateCustomData(body.customData ?? {}, fields, {}, { enforceRequired: false });

    const candidate = await db.candidate.create({
      data: {
        name,
        email,
        phone: str(body.phone),
        resume: str(body.resume),
        resumeName: str(body.resumeName),
        photo: photoKey(body.photo),
        skills: str(body.skills),
        experience: str(body.experience),
        education: str(body.education),
        location: locationFromAnswers(fields, customData) || str(body.location),
        salary: str(body.salary),
        noticePeriod: str(body.noticePeriod),
        notes: str(body.notes),
        tags: str(body.tags),
        customData: JSON.stringify(customData),
      },
      include: { _count: { select: { applications: true } } },
    });
    return json(candidate, 201);
  });
}
