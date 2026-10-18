import { db } from "@/lib/db";
import { handle, json, requireCandidate } from "@/lib/api-candidate";
import { loadFields, loadSections } from "@/lib/candidate-custom";
import { getCvDesign } from "@/lib/cv-design";

/** GET /api/candidate/portal — everything the signed-in candidate needs. */
export async function GET(req: Request) {
  return handle(async () => {
    const account = await requireCandidate(req);
    const [jobs, fields, sections, design, candidate] = await Promise.all([
      db.job.findMany({
        where: { status: "Open" },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, location: true, employmentType: true },
      }),
      loadFields(),
      loadSections(),
      getCvDesign(),
      account.candidateId ? db.candidate.findUnique({ where: { id: account.candidateId } }) : Promise.resolve(null),
    ]);
    return json({
      account: { username: account.username, code: account.code, fullName: account.fullName, email: account.email },
      submitted: !!candidate,
      candidate,
      jobs,
      fields: fields.filter((f) => f.publicForm),
      sections,
      design,
    });
  });
}
