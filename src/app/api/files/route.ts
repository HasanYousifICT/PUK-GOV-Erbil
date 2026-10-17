import { getStorage } from "@/lib/storage";
import { ApiError, handle, json, requireAuth } from "@/lib/api";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".png", ".jpg", ".jpeg"];

/**
 * POST /api/files — multipart/form-data with a `file` field.
 * Stores an attachment for a custom candidate field and returns its storage key.
 */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAuth(req);
    const form = await req.formData().catch(() => null);
    if (!form) throw new ApiError(400, "Expected multipart/form-data");
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "File is required");
    if (file.size === 0) throw new ApiError(400, "File is empty");
    if (file.size > MAX_SIZE) throw new ApiError(400, "File is too large (max 10 MB)");

    const filename = file.name || "file";
    const dot = filename.lastIndexOf(".");
    const ext = dot >= 0 ? filename.toLowerCase().slice(dot) : "";
    if (!ALLOWED.includes(ext)) {
      throw new ApiError(400, "Unsupported file type. Allowed: PDF, Word, Excel, CSV, TXT, PNG, JPG");
    }
    const key = await getStorage().save("attachments", filename, Buffer.from(await file.arrayBuffer()));
    return json({ key, name: filename, size: file.size }, 201);
  });
}
