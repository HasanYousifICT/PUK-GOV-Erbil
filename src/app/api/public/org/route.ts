import { handle, json } from "@/lib/api";
import { getOrg } from "@/lib/org";

/** GET /api/public/org — branding shown on the login and application pages. */
export async function GET() {
  return handle(async () => {
    const res = json(await getOrg());
    res.headers.set("Cache-Control", "no-store");
    return res;
  });
}
