import { sessionCookieHeader } from "@/lib/auth";
import { handle, json } from "@/lib/api";

export async function POST(req: Request) {
  return handle(async () => {
    const res = json({ ok: true });
    res.headers.append("Set-Cookie", sessionCookieHeader(req, null));
    return res;
  });
}
