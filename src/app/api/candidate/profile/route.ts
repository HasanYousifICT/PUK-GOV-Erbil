import { ApiError, handle, requireCandidate } from "@/lib/api-candidate";

/** PUT /api/candidate/profile — a submitted profile is final: only the office can change it. */
export async function PUT(req: Request) {
  return handle(async () => {
    await requireCandidate(req);
    throw new ApiError(403, "Your profile has been submitted and can no longer be edited");
  });
}
