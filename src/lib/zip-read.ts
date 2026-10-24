// Reads a ZIP file from disk (stored or deflated entries) and extracts entries as streams.
// Used by the administrator's "Restore backup". No library; ZIP64 is not supported (backups are far smaller).

import { createReadStream, createWriteStream, promises as fs } from "fs";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import { createInflateRaw } from "zlib";

export type ZipFileEntry = { name: string; method: number; crc: number; csize: number; usize: number; offset: number };

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export async function listZip(file: string): Promise<ZipFileEntry[]> {
  const fh = await fs.open(file, "r");
  try {
    const { size } = await fh.stat();
    const tailLen = Math.min(size, 66_000);
    const tail = Buffer.alloc(tailLen);
    await fh.read(tail, 0, tailLen, size - tailLen);
    let e = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        e = i;
        break;
      }
    }
    if (e < 0) throw new Error("This is not a valid ZIP file");
    const count = tail.readUInt16LE(e + 10);
    const cdSize = tail.readUInt32LE(e + 12);
    const cdOffset = tail.readUInt32LE(e + 16);
    if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new Error("ZIP64 files are not supported");
    if (cdOffset + cdSize > size) throw new Error("The ZIP file is damaged");
    const cd = Buffer.alloc(cdSize);
    await fh.read(cd, 0, cdSize, cdOffset);
    const out: ZipFileEntry[] = [];
    let p = 0;
    for (let i = 0; i < count; i++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error("The ZIP file is damaged");
      const flags = cd.readUInt16LE(p + 8);
      const method = cd.readUInt16LE(p + 10);
      const crc = cd.readUInt32LE(p + 16);
      const csize = cd.readUInt32LE(p + 20);
      const usize = cd.readUInt32LE(p + 24);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      const offset = cd.readUInt32LE(p + 42);
      const name = cd.subarray(p + 46, p + 46 + nameLen).toString("utf8");
      if (flags & 1) throw new Error("Encrypted ZIP files are not supported");
      out.push({ name, method, crc, csize, usize, offset });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  } finally {
    await fh.close();
  }
}

/** Extract one entry to `dest`, checking its size and CRC. */
export async function extractEntry(file: string, entry: ZipFileEntry, dest: string): Promise<void> {
  if (entry.method !== 0 && entry.method !== 8) throw new Error("Unsupported ZIP compression");
  const fh = await fs.open(file, "r");
  let start: number;
  try {
    const head = Buffer.alloc(30);
    await fh.read(head, 0, 30, entry.offset);
    if (head.readUInt32LE(0) !== 0x04034b50) throw new Error("The ZIP file is damaged");
    start = entry.offset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
  } finally {
    await fh.close();
  }

  let crc = 0xffffffff;
  let size = 0;
  const check = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      for (let i = 0; i < chunk.length; i++) crc = CRC_TABLE[(crc ^ chunk[i]) & 0xff] ^ (crc >>> 8);
      size += chunk.length;
      cb(null, chunk);
    },
  });
  const src = createReadStream(file, { start, end: start + entry.csize - 1 });
  const out = createWriteStream(dest);
  if (entry.method === 8) await pipeline(src, createInflateRaw(), check, out);
  else await pipeline(src, check, out);
  if (size !== entry.usize || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) {
    await fs.rm(dest, { force: true });
    throw new Error(`The file "${entry.name}" in the ZIP is damaged`);
  }
}
