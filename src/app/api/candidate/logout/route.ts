import { handle, json } from "@/lib/api";
import { candidateCookie } from "@/lib/candidate-auth";

export async function POST(req: Request) {
  return handle(async () => {
    const res = json({ ok: true });
    res.headers.append("Set-Cookie", candidateCookie(req, null));
    return res;
  });
}
