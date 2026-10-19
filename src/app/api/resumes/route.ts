import { getStorage } from "@/lib/storage";
import { ApiError, getAuthUserOrNull, handle } from "@/lib/api";
import { getCandidateAccount } from "@/lib/candidate-auth";
import { db } from "@/lib/db";

/**
 * GET /api/resumes?key=resumes/<id>-<name>.pdf
 * Authenticated resume download. Key must stay inside the storage scope.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const key = url.searchParams.get("key") || "";
    if (!key || key.includes("..")) throw new ApiError(400, "Invalid storage key");
    if (!(await getAuthUserOrNull(req))) {
      // a candidate may only open files that belong to their own application
      const account = await getCandidateAccount(req);
      const own = account?.candidateId
        ? await db.candidate.findUnique({ where: { id: account.candidateId }, select: { resume: true, photo: true, customData: true } })
        : null;
      const inDraft = !!account?.draft && account.draft.includes(JSON.stringify(key));
      if (!inDraft && (!own || (own.resume !== key && own.photo !== key && !own.customData.includes(JSON.stringify(key))))) {
        throw new ApiError(401, "Unauthorized");
      }
    }

    const data = await getStorage().read(key);
    if (!data) throw new ApiError(404, "Resume file not found");

    const filename = key.split("/").pop() || "resume";
    const ext = filename.toLowerCase().split(".").pop();
    const types: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      csv: "text/csv; charset=utf-8",
      txt: "text/plain; charset=utf-8",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };
    const showInline = ["pdf", "png", "jpg", "jpeg", "webp"].includes(ext || "");
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": types[ext || ""] || "application/octet-stream",
        "Content-Disposition": `${showInline ? "inline" : "attachment"}; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  });
}
