import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAdmin, str } from "@/lib/api";
import { getOrg, ORG_DEFAULTS } from "@/lib/org";

const cut = (v: unknown, n: number) => str(v).trim().slice(0, n);

/** PUT /api/organization — update branding text (administrators only). */
export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const name = cut(body.name, 100);
    if (!name) throw new ApiError(400, "Organization name is required");
    const websiteUrl = cut(body.websiteUrl, 300);
    if (websiteUrl && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(websiteUrl)) {
      throw new ApiError(400, "Website address must start with http:// or https://");
    }
    const data = {
      name,
      tagline: cut(body.tagline, 200),
      byline: cut(body.byline, 100),
      company: cut(body.company, 150),
      website: cut(body.website, 100),
      websiteUrl,
      footer: cut(body.footer, 200),
    };
    await db.organization.upsert({
      where: { id: "org" },
      create: { id: "org", ...data },
      update: data,
    });
    void ORG_DEFAULTS;
    return json(await getOrg());
  });
}
