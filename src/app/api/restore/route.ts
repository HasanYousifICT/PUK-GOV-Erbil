import { createWriteStream, promises as fs } from "fs";
import path from "path";
import os from "os";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { db } from "@/lib/db";
import { ApiError, handle, json, requireAdmin } from "@/lib/api";
import { extractEntry, listZip } from "@/lib/zip-read";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

function sqlitePath(): string | null {
  const url = process.env.DATABASE_URL || "";
  if (!url.startsWith("file:")) return null;
  const p = url.slice(5).split("?")[0];
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), "prisma", p);
}

/** POST /api/restore — administrators only: put a backup ZIP (database + uploads) back. The system restarts afterwards. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    if (req.headers.get("x-confirm") !== "RESTORE") throw new ApiError(400, "Please type RESTORE to confirm");
    const dbFile = sqlitePath();
    if (!dbFile) throw new ApiError(400, "Restore works with the built-in SQLite database only");
    if (process.env.S3_BUCKET) throw new ApiError(400, "Restore works with local file storage only");
    if (!req.body) throw new ApiError(400, "No file was sent");

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
    const work = await fs.mkdtemp(path.join(os.tmpdir(), "oroos-restore-"));
    try {
      // 1. receive the ZIP (streamed to disk, not kept in memory)
      const zipFile = path.join(work, "backup.zip");
      let received = 0;
      const limit = new Transform({
        transform(chunk, _e, cb) {
          received += chunk.length;
          if (received > MAX_BYTES) cb(new ApiError(413, "The file is too large"));
          else cb(null, chunk);
        },
      });
      await pipeline(Readable.fromWeb(req.body as never), limit, createWriteStream(zipFile));

      // 2. check what is inside
      let entries;
      try {
        entries = await listZip(zipFile);
      } catch (e) {
        throw new ApiError(400, e instanceof Error ? e.message : "This is not a valid backup file");
      }
      const clean = (n: string) => n.replace(/\\/g, "/");
      const files = entries.filter((e) => !clean(e.name).endsWith("/"));
      const bad = files.find((e) => clean(e.name).split("/").some((s) => s === ".." || s === "") || path.isAbsolute(e.name));
      if (bad) throw new ApiError(400, "The backup file contains an unsafe path");
      const dbEntries = files.filter((e) => /^database\/[^/]+$/.test(clean(e.name)));
      if (dbEntries.length !== 1) throw new ApiError(400, "This is not an OpenRecruitOS backup (no database inside)");
      const uploads = files.filter((e) => clean(e.name).startsWith("uploads/"));

      // 3. the database: extract next to the live one and check it is a SQLite file
      const newDb = `${dbFile}.restore-tmp`;
      await fs.mkdir(path.dirname(dbFile), { recursive: true });
      await extractEntry(zipFile, dbEntries[0], newDb);
      const head = Buffer.alloc(16);
      const fh = await fs.open(newDb, "r");
      try {
        await fh.read(head, 0, 16, 0);
      } finally {
        await fh.close();
      }
      if (head.toString("latin1") !== "SQLite format 3\0") {
        await fs.rm(newDb, { force: true });
        throw new ApiError(400, "The database inside the backup is not valid");
      }

      // 4. the uploaded files (added to the existing ones; nothing is deleted)
      for (const e of uploads) {
        const rel = clean(e.name).slice("uploads/".length);
        const dest = path.resolve(uploadDir, rel);
        if (!dest.startsWith(uploadDir + path.sep)) throw new ApiError(400, "The backup file contains an unsafe path");
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await extractEntry(zipFile, e, dest);
      }

      // 5. swap the database (the old one is kept next to it as a safety copy)
      await db.$disconnect().catch(() => undefined);
      const exists = await fs.stat(dbFile).then(() => true, () => false);
      if (exists) await fs.copyFile(dbFile, `${dbFile}.before-restore-${Date.now()}`);
      for (const ext of ["-wal", "-shm", "-journal"]) await fs.rm(dbFile + ext, { force: true });
      await fs.rename(newDb, dbFile);

      // 6. restart so the database is opened again and its structure is brought up to date
      if (process.env.NODE_ENV !== "test") setTimeout(() => process.exit(1), 1500);
      return json({ ok: true, files: uploads.length, restarting: true });
    } finally {
      await fs.rm(work, { recursive: true, force: true }).catch(() => undefined);
    }
  });
}
