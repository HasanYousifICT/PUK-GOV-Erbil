import { requireCandidate } from "@/lib/api-candidate";
import { handle } from "@/lib/api";
import { POST as publicUpload } from "@/app/api/public/upload/route";

/** POST /api/candidate/upload — same as the public upload, but only for signed-in candidates. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireCandidate(req);
    return publicUpload(req);
  });
}
