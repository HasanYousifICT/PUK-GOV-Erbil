// OpenRecruitOS — File storage abstraction
// Community Edition ships a LocalStorage driver (files under /uploads).
// A driver with the same interface (e.g. S3Storage) can be added for OpenRecruitOS Cloud
// without touching any caller code — just register it in `getStorage()`.

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface StorageDriver {
  /** Persist bytes and return the storage key. */
  save(scope: string, filename: string, data: Buffer): Promise<string>;
  /** Read bytes for a storage key. Returns null when not found. */
  read(key: string): Promise<Buffer | null>;
  /** Delete a stored object. Safe to call for missing keys. */
  delete(key: string): Promise<void>;
  /** Normalize an original filename into a safe on-disk name. */
  sanitize(filename: string): string;
}

class LocalStorage implements StorageDriver {
  constructor(private baseDir: string) {}

  sanitize(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(-80) || "file";
  }

  async save(scope: string, filename: string, data: Buffer): Promise<string> {
    const key = `${scope}/${randomUUID()}-${this.sanitize(filename)}`;
    const abs = path.join(this.baseDir, key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, data);
    return key;
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      // Guard against path traversal
      const abs = path.resolve(this.baseDir, key);
      if (!abs.startsWith(path.resolve(this.baseDir))) return null;
      return await fs.readFile(abs);
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const abs = path.resolve(this.baseDir, key);
      if (!abs.startsWith(path.resolve(this.baseDir))) return;
      await fs.unlink(abs);
    } catch {
      // ignore missing files
    }
  }
}

/**
 * S3-compatible driver (AWS S3, Cloudflare R2, Supabase Storage, Backblaze B2, MinIO…).
 * Enabled when S3_BUCKET is set. Files stay private: they are only served through
 * the authenticated /api/resumes route.
 */
class S3Storage implements StorageDriver {
  private clientPromise: Promise<any> | null = null;
  constructor(private bucket: string) {}

  sanitize(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(-80) || "file";
  }

  private async sdk() {
    return import("@aws-sdk/client-s3");
  }

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = this.sdk().then(
        ({ S3Client }) =>
          new S3Client({
            region: process.env.S3_REGION || "auto",
            endpoint: process.env.S3_ENDPOINT || undefined,
            forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
            },
          })
      );
    }
    return this.clientPromise;
  }

  async save(scope: string, filename: string, data: Buffer): Promise<string> {
    const key = `${scope}/${randomUUID()}-${this.sanitize(filename)}`;
    const { PutObjectCommand } = await this.sdk();
    await (await this.client()).send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data }));
    return key;
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      if (key.includes("..")) return null;
      const { GetObjectCommand } = await this.sdk();
      const res = await (await this.client()).send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (key.includes("..")) return;
      const { DeleteObjectCommand } = await this.sdk();
      await (await this.client()).send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      // ignore
    }
  }
}

let driver: StorageDriver | null = null;

/** Swap this for an S3-compatible driver in the commercial/cloud edition. */
export function getStorage(): StorageDriver {
  if (!driver) {
    if (process.env.S3_BUCKET) {
      driver = new S3Storage(process.env.S3_BUCKET);
      return driver;
    }
    driver = new LocalStorage(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
  }
  return driver;
}
