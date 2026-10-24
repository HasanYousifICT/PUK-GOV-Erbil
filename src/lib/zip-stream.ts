// A tiny streaming ZIP writer (no compression, no library): used for the administrator's backup download.
// Files are read and sent piece by piece, so even a large uploads folder does not fill the memory.

import { createReadStream } from "fs";

export type ZipEntry = { name: string; path?: string; data?: Uint8Array; mtime?: Date };

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crcUpdate(crc: number, chunk: Uint8Array): number {
  let c = crc ^ 0xffffffff;
  for (let i = 0; i < chunk.length; i++) c = CRC_TABLE[(c ^ chunk[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d: Date): { time: number; date: number } {
  const y = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const enc = new TextEncoder();

function u16(v: DataView, o: number, n: number) {
  v.setUint16(o, n, true);
}
function u32(v: DataView, o: number, n: number) {
  v.setUint32(o, n >>> 0, true);
}

async function* chunksOf(e: ZipEntry): AsyncGenerator<Uint8Array> {
  if (e.data) {
    yield e.data;
    return;
  }
  if (e.path) {
    for await (const c of createReadStream(e.path, { highWaterMark: 256 * 1024 })) yield c as Uint8Array;
  }
}

async function* zipBytes(entries: AsyncIterable<ZipEntry> | Iterable<ZipEntry>): AsyncGenerator<Uint8Array> {
  let offset = 0;
  const central: { name: Uint8Array; crc: number; size: number; offset: number; time: number; date: number }[] = [];

  for await (const e of entries) {
    const name = enc.encode(e.name);
    const { time, date } = dosTime(e.mtime ?? new Date());
    const head = new Uint8Array(30 + name.length);
    const hv = new DataView(head.buffer);
    u32(hv, 0, 0x04034b50);
    u16(hv, 4, 20);
    u16(hv, 6, 0x0808); // sizes follow the data; UTF-8 names
    u16(hv, 8, 0); // stored
    u16(hv, 10, time);
    u16(hv, 12, date);
    u16(hv, 26, name.length);
    head.set(name, 30);
    const startOffset = offset;
    yield head;
    offset += head.length;

    let crc = 0;
    let size = 0;
    for await (const chunk of chunksOf(e)) {
      crc = crcUpdate(crc, chunk);
      size += chunk.length;
      yield chunk;
      offset += chunk.length;
    }
    const dd = new Uint8Array(16);
    const dv = new DataView(dd.buffer);
    u32(dv, 0, 0x08074b50);
    u32(dv, 4, crc);
    u32(dv, 8, size);
    u32(dv, 12, size);
    yield dd;
    offset += dd.length;
    central.push({ name, crc, size, offset: startOffset, time, date });
  }

  const cdStart = offset;
  for (const c of central) {
    const rec = new Uint8Array(46 + c.name.length);
    const v = new DataView(rec.buffer);
    u32(v, 0, 0x02014b50);
    u16(v, 4, 20);
    u16(v, 6, 20);
    u16(v, 8, 0x0808);
    u16(v, 10, 0);
    u16(v, 12, c.time);
    u16(v, 14, c.date);
    u32(v, 16, c.crc);
    u32(v, 20, c.size);
    u32(v, 24, c.size);
    u16(v, 28, c.name.length);
    u32(v, 42, c.offset);
    rec.set(c.name, 46);
    yield rec;
    offset += rec.length;
  }
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  u32(ev, 0, 0x06054b50);
  u16(ev, 8, central.length);
  u16(ev, 10, central.length);
  u32(ev, 12, offset - cdStart);
  u32(ev, 16, cdStart);
  yield end;
}

/** A web ReadableStream of the ZIP file, ready to be the body of a Response. */
export function zipStream(entries: AsyncIterable<ZipEntry> | Iterable<ZipEntry>): ReadableStream<Uint8Array> {
  const it = zipBytes(entries);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await it.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (e) {
        controller.error(e);
      }
    },
    async cancel() {
      await it.return(undefined);
    },
  });
}
