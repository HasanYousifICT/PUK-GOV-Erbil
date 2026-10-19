import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireCandidate, str } from "@/lib/api-candidate";
import { loadFields, validateCustomData } from "@/lib/candidate-custom";
import { parseCustomData } from "@/lib/candidate-fields";
import { deleteFiles } from "@/lib/candidate-custom";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cut = (v: unknown, n: number) => str(v).trim().slice(0, n);

/** PUT /api/candidate/profile — after submitting, the candidate can still complete or correct their profile. */
export async function PUT(req: Request) {
  return handle(async () => {
    const account = await requireCandidate(req);
    if (!account.candidateId) throw new ApiError(409, "Please submit your application first");
    const existing = await db.candidate.findUnique({ where: { id: account.candidateId } });
    if (!existing) throw new ApiError(404, "Profile not found");
    const body = await readJson<Record<string, unknown>>(req);

    const name = cut(body.name, 100);
    const email = cut(body.email, 254).toLowerCase();
    if (name.length < 2) throw new ApiError(400, "Please enter your full name");
    if (!EMAIL_RE.test(email)) throw new ApiError(400, "Please enter a valid email address");
    const resume = str(body.resume);
    if (resume && (!resume.startsWith("resumes/") || resume.includes(".."))) throw new ApiError(400, "Invalid resume");
    const photo = str(body.photo);
    if (photo && (!photo.startsWith("photos/") || photo.includes(".."))) throw new ApiError(400, "Invalid photo");

    const fields = (await loadFields()).filter((f) => f.publicForm);
    const { data: customData, removedFiles } = validateCustomData(body.customData ?? {}, fields, parseCustomData(existing.customData));

    const replaced = [existing.resume && existing.resume !== resume ? existing.resume : "", existing.photo && existing.photo !== photo ? existing.photo : ""].filter(Boolean);
    const candidate = await db.candidate.update({
      where: { id: existing.id },
      data: {
        name,
        email,
        phone: cut(body.phone, 50),
        location: cut(body.location, 200),
        notes: cut(body.notes, 2000),
        resume,
        resumeName: resume ? cut(body.resumeName, 200) : "",
        photo,
        customData: JSON.stringify(customData),
      },
    });
    await deleteFiles([...removedFiles, ...replaced]);
    return json({ ok: true, candidate });
  });
}
