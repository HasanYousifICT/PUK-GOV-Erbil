import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

/** GET /api/public/logo — the uploaded organization logo (public: shown before login). */
export async function GET() {
  const row = await db.organization.findUnique({ where: { id: "org" } }).catch(() => null);
  if (!row?.logo) return new Response("Not found", { status: 404 });
  const data = await getStorage().read(row.logo);
  if (!data) return new Response("Not found", { status: 404 });
  const ext = row.logo.slice(row.logo.lastIndexOf(".") + 1).toLowerCase();
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
