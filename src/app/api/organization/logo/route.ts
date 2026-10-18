import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { ApiError, handle, json, requireAdmin } from "@/lib/api";
import { getOrg, ORG_DEFAULTS } from "@/lib/org";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED = [".png", ".jpg", ".jpeg", ".webp"];

async function ensureRow() {
  return db.organization.upsert({
    where: { id: "org" },
    create: { id: "org", ...ORG_DEFAULTS },
    update: {},
  });
}

/** POST /api/organization/logo — upload a new logo (PNG, JPG or WebP, max 2 MB). */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "File is required");
    if (file.size === 0) throw new ApiError(400, "File is empty");
    if (file.size > MAX_SIZE) throw new ApiError(400, "Logo is too large (max 2 MB)");
    const name = file.name || "logo";
    const ext = name.lastIndexOf(".") >= 0 ? name.toLowerCase().slice(name.lastIndexOf(".")) : "";
    if (!ALLOWED.includes(ext)) throw new ApiError(400, "Unsupported logo format. Allowed: PNG, JPG, WebP");

    const row = await ensureRow();
    const key = await getStorage().save("branding", `logo${ext}`, Buffer.from(await file.arrayBuffer()));
    await db.organization.update({ where: { id: "org" }, data: { logo: key, logoVersion: row.logoVersion + 1 } });
    if (row.logo) await getStorage().delete(row.logo);
    return json(await getOrg(), 201);
  });
}

/** DELETE /api/organization/logo — go back to the built-in logo. */
export async function DELETE(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const row = await ensureRow();
    if (row.logo) await getStorage().delete(row.logo);
    await db.organization.update({ where: { id: "org" }, data: { logo: "", logoVersion: row.logoVersion + 1 } });
    return json(await getOrg());
  });
}
