import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireCandidate, str } from "@/lib/api-candidate";
import { loadFields } from "@/lib/candidate-custom";

const cut = (v: unknown, n: number) => str(v).slice(0, n);
const keyOk = (k: string, scope: string) => !k || (k.startsWith(`${scope}/`) && !k.includes(".."));

/**
 * PUT /api/candidate/draft — save the half-filled application so the candidate can come back later.
 * Nothing is checked as required here; the checks happen when the application is submitted.
 */
export async function PUT(req: Request) {
  return handle(async () => {
    const account = await requireCandidate(req);
    if (account.candidateId) throw new ApiError(409, "Your application has already been submitted");
    const body = await readJson<Record<string, unknown>>(req);

    const known = new Set((await loadFields()).filter((f) => f.publicForm).map((f) => f.id));
    const custom: Record<string, unknown> = {};
    const src = body.customData && typeof body.customData === "object" && !Array.isArray(body.customData) ? (body.customData as Record<string, unknown>) : {};
    for (const [k, v] of Object.entries(src)) if (known.has(k) && v !== null && v !== undefined && v !== "") custom[k] = v;

    const resume = str(body.resume);
    const photo = str(body.photo);
    const draft = {
      name: cut(body.name, 100),
      email: cut(body.email, 254),
      phone: cut(body.phone, 50),
      location: cut(body.location, 200),
      notes: cut(body.notes, 2000),
      jobId: cut(body.jobId, 60),
      resume: keyOk(resume, "resumes") ? resume : "",
      resumeName: cut(body.resumeName, 200),
      photo: keyOk(photo, "photos") ? photo : "",
      customData: custom,
    };
    const text = JSON.stringify(draft);
    if (text.length > 400_000) throw new ApiError(400, "The saved form is too large");
    const row = await db.candidateAccount.update({ where: { id: account.id }, data: { draft: text, draftAt: new Date() }, select: { draftAt: true } });
    return json({ ok: true, savedAt: row.draftAt });
  });
}
