import { handle, json, requireAuth } from "@/lib/api";
import { sameTitleAndClass } from "@/lib/job-specialist";

/** GET /api/jobs/duplicates?title=&categoryId=&excludeId= — how many other jobs share this title and classification. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAuth(req);
    const sp = new URL(req.url).searchParams;
    const title = (sp.get("title") ?? "").trim();
    const categoryId = sp.get("categoryId") ?? "";
    if (!title || !categoryId) return json({ count: 0 });
    const same = await sameTitleAndClass(title, categoryId, sp.get("excludeId") || undefined);
    return json({ count: same.length });
  });
}
