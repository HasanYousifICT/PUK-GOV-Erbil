// Lets an administrator look up a forgotten password. The password is kept ENCRYPTED
// (AES-256-GCM) next to the normal one-way hash; login still uses only the hash.
// Key: PASSWORD_VAULT_KEY (recommended — set it once and never change it), else JWT_SECRET.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function key(): Buffer {
  const secret = process.env.PASSWORD_VAULT_KEY || process.env.JWT_SECRET || "openrecruitos-dev-secret-change-me-in-production";
  return createHash("sha256").update("vault:" + secret).digest();
}

export function sealPassword(password: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(password, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

/** The password, or null when there is none stored or the key changed. */
export function openPassword(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  try {
    const [iv, tag, enc] = sealed.split(".").map((p) => Buffer.from(p, "base64"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
