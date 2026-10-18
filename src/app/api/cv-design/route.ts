import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAdmin, requireAuth, str } from "@/lib/api";
import { getCvDesign } from "@/lib/cv-design";

/** GET /api/cv-design — staff read the current CV design. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAuth(req);
    return json(await getCvDesign());
  });
}

/** PUT /api/cv-design — administrators design the CV. */
export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const b = await readJson<Record<string, unknown>>(req);
    const layout = ["classic", "modern", "sidebar"].includes(str(b.layout)) ? str(b.layout) : "classic";
    const accent = str(b.accent);
    if (!/^#[0-9a-fA-F]{6}$/.test(accent)) throw new ApiError(400, "Choose a valid colour");
    const hidden = Array.isArray(b.hiddenSections)
      ? b.hiddenSections.filter((x): x is string => typeof x === "string").slice(0, 100)
      : [];
    const data = {
      layout,
      accent,
      font: b.font === "serif" ? "serif" : "sans",
      showCode: b.showCode !== false,
      showLogo: b.showLogo !== false,
      hiddenSections: JSON.stringify(hidden),
      headerNote: str(b.headerNote).trim().slice(0, 300),
      footerNote: str(b.footerNote).trim().slice(0, 300),
    };
    await db.cvDesign.upsert({ where: { id: "cv" }, create: { id: "cv", ...data }, update: data });
    return json(await getCvDesign());
  });
}
