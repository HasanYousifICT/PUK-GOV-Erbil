import { db } from "@/lib/db";
import { ApiError, handle, json, readJson, requireAuth, requireLevel, str } from "@/lib/api";
import { parseCustomData } from "@/lib/candidate-fields";
import { deleteFiles, fileKeysOf, loadFields, validateCustomData } from "@/lib/candidate-custom";

type Params = { params: Promise<{ id: string }> };

/** GET /api/candidates/:id — full profile with applications (+jobs) and interviews */
export async function GET(req: Request, { params }: Params) {
  return handle(async () => {
    await requireLevel(req, "candidates", "view");
    const { id } = await params;
    const candidate = await db.candidate.findUnique({
      where: { id },
      include: {
        applications: {
          orderBy: { appliedAt: "desc" },
          include: {
            job: { select: { id: true, title: true, location: true, status: true, employmentType: true } },
            history: { orderBy: { changedAt: "asc" } },
            interviews: { orderBy: { date: "desc" } },
          },
        },
        _count: { select: { applications: true } },
      },
    });
    if (!candidate) throw new ApiError(404, "Candidate not found");
    return json(candidate);
  });
}

/** PUT /api/candidates/:id — update profile (incl. resume replace) */
export async function PUT(req: Request, { params }: Params) {
  return handle(async () => {
    await requireLevel(req, "candidates", "edit");
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(req);
    const existing = await db.candidate.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Candidate not found");

    const data: Record<string, string> = {};
    if ("name" in body) {
      const name = str(body.name).trim();
      if (!name) throw new ApiError(400, "Candidate name is required");
      data.name = name;
    }
    if ("email" in body) {
      const email = str(body.email).trim();
      if (email && email !== existing.email) {
        const dup = await db.candidate.findFirst({ where: { email } });
        if (dup) throw new ApiError(409, "A candidate with this email already exists");
      }
      data.email = email;
    }
    if ("photo" in body) {
      const k = str(body.photo);
      if (k && (!k.startsWith("photos/") || k.includes(".."))) throw new ApiError(400, "Invalid photo");
      data.photo = k;
    }
    for (const key of [
      "phone", "resume", "resumeName", "skills", "experience", "education",
      "location", "salary", "noticePeriod", "notes", "tags",
    ] as const) {
      if (key in body) data[key] = str(body[key]);
    }

    let removedFiles: string[] = [];
    let customData: string | undefined;
    if ("customData" in body) {
      const fields = await loadFields();
      const result = validateCustomData(body.customData, fields, parseCustomData(existing.customData), { enforceRequired: false });
      customData = JSON.stringify(result.data);
      removedFiles = result.removedFiles;
    }

    const candidate = await db.candidate.update({
      where: { id },
      data: { ...data, ...(customData !== undefined ? { customData } : {}) },
      include: { _count: { select: { applications: true } } },
    });
    await deleteFiles(removedFiles);
    if (data.photo !== undefined && existing.photo && existing.photo !== data.photo) await deleteFiles([existing.photo]);
    return json(candidate);
  });
}

/** DELETE /api/candidates/:id — also removes the stored resume file */
export async function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    await requireLevel(req, "candidates", "edit");
    const { id } = await params;
    const existing = await db.candidate.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Candidate not found");
    await db.candidate.delete({ where: { id } });
    if (existing.resume) {
      const { getStorage } = await import("@/lib/storage");
      await getStorage().delete(existing.resume);
    }
    if (existing.photo) await deleteFiles([existing.photo]);
    await deleteFiles(fileKeysOf(existing.customData));
    return json({ ok: true });
  });
}
