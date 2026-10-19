import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAuth, requireLevel, str } from "@/lib/api";
import { parseCustomData } from "@/lib/candidate-fields";
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

/** GET /api/candidates?q=&filters=<json> — list candidates with application counts */
export async function GET(req: Request) {
  return handle(async () => {
    await requireLevel(req, "candidates", "view");
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const f = parseFilters(url.searchParams.get("filters"));

    const and: Prisma.CandidateWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { skills: { contains: q } },
          { location: { contains: q } },
          { tags: { contains: q } },
          { code: { contains: q } },
        ],
      });
    }
    if (f.resume === "has") and.push({ resume: { not: "" } });
    if (f.resume === "none") and.push({ resume: "" });
    if (f.from) and.push({ createdAt: { gte: new Date(`${f.from}T00:00:00.000Z`) } });
    if (f.to) and.push({ createdAt: { lte: new Date(`${f.to}T23:59:59.999Z`) } });

    if (f.jobId) {
      if (f.jobMode === "notIn") and.push({ applications: { none: { jobId: f.jobId } } });
      else and.push({ applications: { some: { jobId: f.jobId, ...(f.stage ? { stage: f.stage } : {}) } } });
    } else {
      if (f.applied === "none") and.push({ applications: { none: {} } });
      if (f.applied === "some" && !f.stage) and.push({ applications: { some: {} } });
      if (f.stage) and.push({ applications: { some: { stage: f.stage } } });
    }

    let candidates = await db.candidate.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { applications: true } } },
    });

    // Case-insensitive text filters run here so they behave the same on SQLite and PostgreSQL.
    if (f.location) {
      const loc = f.location.toLowerCase();
      candidates = candidates.filter((c) => c.location.toLowerCase().includes(loc));
    }
    if (f.skills) {
      const terms = f.skills
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (terms.length) {
        candidates = candidates.filter((c) => {
          const have = c.skills.toLowerCase();
          return terms.every((t) => have.includes(t));
        });
      }
    }

    const active = (f.custom ?? []).filter(isCustomFilterActive);
    const std = active.filter((c) => isStdField(c.fieldId));
    if (std.length) {
      candidates = candidates.filter((c) => std.every((flt) => matchesStdFilter(c as unknown as Record<string, unknown>, flt)));
    }
    const custom = active.filter((c) => !isStdField(c.fieldId));
    if (custom.length) {
      const fields = await loadFields();
      const byId = new Map(fields.map((x) => [x.id, x]));
      const usable = custom.filter((c) => byId.has(c.fieldId));
      if (usable.length) {
        candidates = candidates.filter((c) => {
          const data = parseCustomData(c.customData);
          return usable.every((flt) => matchesCustomFilter(data, byId.get(flt.fieldId)!, flt));
        });
      }
    }
    return json(candidates);
  });
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
        location: str(body.location),
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
