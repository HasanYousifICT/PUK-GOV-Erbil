import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, str } from "@/lib/api";
import { locationFromAnswers } from "@/lib/candidate-fields";
import { loadFields, validateCustomData } from "@/lib/candidate-custom";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cut = (v: unknown, n: number) => str(v).trim().slice(0, n);

/**
 * POST /api/public/apply — anonymous candidate application.
 * Never overwrites an existing candidate: if the e-mail is already known, only the
 * job application (if any) is added. The response is the same either way.
 */
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(`apply:${clientIp(req)}`, 5, 60 * 60 * 1000);
    const body = await readJson<Record<string, unknown>>(req);

    // Honeypot: real people never fill this hidden field. Pretend success.
    if (str(body.website)) return json({ ok: true });

    const name = cut(body.name, 100);
    const email = cut(body.email, 254).toLowerCase();
    if (name.length < 2) throw new ApiError(400, "Please enter your full name");
    if (!EMAIL_RE.test(email)) throw new ApiError(400, "Please enter a valid email address");

    const resume = str(body.resume);
    if (resume && (!resume.startsWith("resumes/") || resume.includes(".."))) {
      throw new ApiError(400, "Invalid resume");
    }

    let jobId = "";
    if (str(body.jobId)) {
      const job = await db.job.findUnique({ where: { id: str(body.jobId) }, select: { id: true, status: true } });
      if (!job || job.status !== "Open") throw new ApiError(400, "This job is no longer open");
      jobId = job.id;
    }

    const fields = (await loadFields()).filter((f) => f.publicForm);
    const { data: customData } = validateCustomData(body.customData ?? {}, fields);

    let candidate = await db.candidate.findFirst({ where: { email }, select: { id: true } });
    if (!candidate) {
      candidate = await db.candidate.create({
        data: {
          name,
          email,
          phone: cut(body.phone, 50),
          resume: resume,
          resumeName: resume ? cut(body.resumeName, 200) : "",
          photo: str(body.photo).startsWith("photos/") && !str(body.photo).includes("..") ? str(body.photo) : "",
          skills: cut(body.skills, 1000),
          experience: cut(body.experience, 200),
          education: cut(body.education, 500),
          location: locationFromAnswers(fields, customData) || cut(body.location, 200),
          salary: cut(body.salary, 100),
          noticePeriod: cut(body.noticePeriod, 100),
          notes: cut(body.notes, 2000),
          tags: "Online application",
          customData: JSON.stringify(customData),
        },
        select: { id: true },
      });
    }

    if (jobId) {
      const exists = await db.application.findFirst({ where: { candidateId: candidate.id, jobId }, select: { id: true } });
      if (!exists) {
        await db.application.create({
          data: {
            candidateId: candidate.id,
            jobId,
            stage: "Applied",
            history: { create: { previousStage: "", newStage: "Applied" } },
          },
        });
      }
    }
    return json({ ok: true }, 201);
  });
}
