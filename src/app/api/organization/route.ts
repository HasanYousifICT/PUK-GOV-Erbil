import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAdmin, str } from "@/lib/api";
import { getOrg, ORG_DEFAULTS } from "@/lib/org";

const cut = (v: unknown, n: number) => str(v).trim().slice(0, n);

/** PUT /api/organization — update branding text (administrators only). */
export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    // only the fields that are sent are changed
    const data: Record<string, string> = {};
    const text: [string, number][] = [
      ["name", 100], ["tagline", 200], ["byline", 100], ["company", 150], ["website", 100],
      ["websiteUrl", 300], ["footer", 200], ["bannerName", 100], ["version", 40], ["copyright", 200],
    ];
    for (const [key, max] of text) if (key in body) data[key] = cut(body[key], max);
    if ("name" in data && !data.name) throw new ApiError(400, "Organization name is required");
    if (data.websiteUrl && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(data.websiteUrl)) {
      throw new ApiError(400, "Website address must start with http:// or https://");
    }
    await db.organization.upsert({
      where: { id: "org" },
      create: { id: "org", name: ORG_DEFAULTS.name, ...data },
      update: data,
    });
    void ORG_DEFAULTS;
    return json(await getOrg());
  });
}
