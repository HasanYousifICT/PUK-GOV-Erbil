import { withTitleCkb } from "@/lib/job-titles";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { loadFields, loadSections } from "@/lib/candidate-custom";

/** GET /api/public/form — what an anonymous applicant needs: open jobs + public custom fields. */
export async function GET() {
  return handle(async () => {
    const [jobs, fields, sections] = await Promise.all([
      db.job.findMany({
        where: { status: "Open" },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, location: true, employmentType: true },
      }),
      loadFields(),
      loadSections(),
    ]);
    return json({ jobs: await withTitleCkb(jobs), fields: fields.filter((f) => f.publicForm), sections });
  });
}
