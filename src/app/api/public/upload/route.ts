import { getStorage } from "@/lib/storage";
import { getResumeParser } from "@/lib/resume-parser";
import { ApiError, handle, json } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const MAX_SIZE = 8 * 1024 * 1024; // 8 MB
const RESUME_EXT = [".pdf", ".doc", ".docx"];
const ATTACH_EXT = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".png", ".jpg", ".jpeg"];

/**
 * POST /api/public/upload — anonymous upload for the public application form.
 * multipart: `file`, `kind` = "resume" | "attachment". A resume is also parsed to pre-fill the form.
 */
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(`upload:${clientIp(req)}`, 20, 60 * 60 * 1000);
    const form = await req.formData().catch(() => null);
    if (!form) throw new ApiError(400, "Expected multipart/form-data");
    const file = form.get("file");
    const kind = form.get("kind") === "resume" ? "resume" : "attachment";
    if (!(file instanceof File)) throw new ApiError(400, "File is required");
    if (file.size === 0) throw new ApiError(400, "File is empty");
    if (file.size > MAX_SIZE) throw new ApiError(400, "File is too large (max 8 MB)");

    const filename = file.name || "file";
    const dot = filename.lastIndexOf(".");
    const ext = dot >= 0 ? filename.toLowerCase().slice(dot) : "";
    if (!(kind === "resume" ? RESUME_EXT : ATTACH_EXT).includes(ext)) {
      throw new ApiError(
        400,
        kind === "resume"
          ? "Unsupported format. Allowed: PDF, DOC, DOCX"
          : "Unsupported file type. Allowed: PDF, Word, Excel, CSV, TXT, PNG, JPG"
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = await getStorage().save(kind === "resume" ? "resumes" : "attachments", filename, buffer);

    if (kind === "attachment") return json({ key, name: filename }, 201);

    let parsed = { name: "", email: "", phone: "", skills: "", experience: "", education: "" };
    try {
      const parser = getResumeParser();
      parsed = parser.parse((await parser.extractText(buffer, filename)) || "");
    } catch {
      // parsing is optional
    }
    return json({ key, name: filename, parsed }, 201);
  });
}
