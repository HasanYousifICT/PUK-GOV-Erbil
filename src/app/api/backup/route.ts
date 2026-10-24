import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { db } from "@/lib/db";
import { ApiError, handle, requireAdmin } from "@/lib/api";
import { zipStream, ZipEntry } from "@/lib/zip-stream";

export const dynamic = "force-dynamic";

/** The SQLite database file named by DATABASE_URL (relative paths are relative to the prisma folder, like Prisma does). */
function sqlitePath(): string | null {
  const url = process.env.DATABASE_URL || "";
  if (!url.startsWith("file:")) return null;
  const p = url.slice(5).split("?")[0];
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), "prisma", p);
}

async function* walk(dir: string, base = dir): AsyncGenerator<{ rel: string; full: string; mtime: Date }> {
  let items;
  try {
    items = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) yield* walk(full, base);
    else if (it.isFile()) {
      const st = await fs.stat(full);
      yield { rel: path.relative(base, full).split(path.sep).join("/"), full, mtime: st.mtime };
    }
  }
}

const README = `OpenRecruitOS backup
====================
database/ : a consistent copy of the database (SQLite).
uploads/  : every uploaded file (CVs, photos, documents, logo).

To restore: stop the app, put the database file back at the DATABASE_URL path
(for example /data/custom.db) and the uploads folder back at the UPLOAD_DIR path
(for example /data/uploads), then start the app again.
Keep this file private: it contains personal data of candidates and the password hashes.
`;

/** GET /api/backup — administrators only: one ZIP with the database and all uploaded files. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const dbFile = sqlitePath();
    if (!dbFile) throw new ApiError(400, "Automatic backup works with the built-in SQLite database only");

    // a consistent snapshot of the live database
    const snapshot = path.join(os.tmpdir(), `oroos-backup-${Date.now()}.db`);
    try {
      await db.$executeRawUnsafe(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
    } catch {
      // older SQLite: plain copy of the file
      await fs.copyFile(dbFile, snapshot);
    }

    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
    async function* entries(): AsyncGenerator<ZipEntry> {
      try {
        yield { name: "README.txt", data: new TextEncoder().encode(README) };
        yield { name: `database/${path.basename(dbFile!)}`, path: snapshot, mtime: new Date() };
        for await (const f of walk(uploadDir)) yield { name: `uploads/${f.rel}`, path: f.full, mtime: f.mtime };
      } finally {
        fs.rm(snapshot, { force: true }).catch(() => undefined);
      }
    }

    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
    return new Response(zipStream(entries()), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="openrecruitos-backup-${stamp}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
