import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireCandidate, str } from "@/lib/api-candidate";
import { loadFields, validateCustomData } from "@/lib/candidate-custom";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cut = (v: unknown, n: number) => str(v).trim().slice(0, n);

/** POST /api/candidate/apply — the signed-in candidate submits their application (once). */
export async function POST(req: Request) {
  return handle(async () => {
    const account = await requireCandidate(req);
    if (account.candidateId) throw new ApiError(409, "Your application has already been submitted");
    const body = await readJson<Record<string, unknown>>(req);

    const name = cut(body.name, 100);
    const email = cut(body.email, 254).toLowerCase();
    if (name.length < 2) throw new ApiError(400, "Please enter your full name");
    if (!EMAIL_RE.test(email)) throw new ApiError(400, "Please enter a valid email address");
    const resume = str(body.resume);
    if (resume && (!resume.startsWith("resumes/") || resume.includes(".."))) throw new ApiError(400, "Invalid resume");

    let jobId = "";
    if (str(body.jobId)) {
      const job = await db.job.findUnique({ where: { id: str(body.jobId) }, select: { id: true, status: true } });
      if (!job || job.status !== "Open") throw new ApiError(400, "This job is no longer open");
      jobId = job.id;
    }

    const fields = (await loadFields()).filter((f) => f.publicForm);
    const { data: customData } = validateCustomData(body.customData ?? {}, fields);

    const candidate = await db.$transaction(async (tx) => {
      const fresh = await tx.candidateAccount.findUnique({ where: { id: account.id }, select: { candidateId: true } });
      if (!fresh || fresh.candidateId) throw new ApiError(409, "Your application has already been submitted");
      const c = await tx.candidate.create({
        data: {
          name,
          email,
          code: account.code,
          phone: cut(body.phone, 50),
          resume,
          resumeName: resume ? cut(body.resumeName, 200) : "",
          skills: cut(body.skills, 1000),
          experience: cut(body.experience, 200),
          education: cut(body.education, 500),
          location: cut(body.location, 200),
          salary: cut(body.salary, 100),
          noticePeriod: cut(body.noticePeriod, 100),
          notes: cut(body.notes, 2000),
          tags: "Candidate portal",
          customData: JSON.stringify(customData),
        },
      });
      await tx.candidateAccount.update({ where: { id: account.id }, data: { candidateId: c.id, submittedAt: new Date() } });
      if (jobId) {
        await tx.application.create({
          data: {
            candidateId: c.id,
            jobId,
            stage: "Applied",
            history: { create: { previousStage: "", newStage: "Applied" } },
          },
        });
      }
      return c;
    });
    return json({ ok: true, candidate }, 201);
  });
}
