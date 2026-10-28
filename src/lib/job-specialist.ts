// Server-only: jobs with the same title and classification must be told apart by a described "specialist".

import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Other jobs that have this exact title and classification (title compared without case / extra spaces). */
export async function sameTitleAndClass(title: string, categoryId: string, excludeId?: string) {
  const sqlite = (process.env.DATABASE_URL ?? "file:").startsWith("file:");
  const rows = await db.job.findMany({
    where: {
      categoryId,
      title: sqlite ? { contains: title.trim() } : { contains: title.trim(), mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, title: true, specialist: true, specialistNote: true },
    take: 200,
  });
  return rows.filter((r) => norm(r.title) === norm(title));
}

/**
 * Validates the specialist choice and returns what to store. A job whose title and classification are
 * already used by another job must be a specialist job with its own description.
 */
export async function resolveSpecialist(input: {
  title: string;
  categoryId: string;
  specialist: unknown;
  note: unknown;
  excludeId?: string;
}): Promise<{ specialist: boolean; specialistNote: string }> {
  const specialist = input.specialist === true || input.specialist === "true";
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : "";
  const same = await sameTitleAndClass(input.title, input.categoryId, input.excludeId);
  if (same.length > 0 && !specialist) {
    throw new ApiError(400, "A job with this title and classification already exists — this one must be a specialist job");
  }
  if (specialist && !note) throw new ApiError(400, "Describe the specialist");
  if (specialist && same.some((j) => j.specialist && norm(j.specialistNote) === norm(note))) {
    throw new ApiError(400, "Another job with this title and classification already has this specialist description");
  }
  return { specialist, specialistNote: specialist ? note : "" };
}
