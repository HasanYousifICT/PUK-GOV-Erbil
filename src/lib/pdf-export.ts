// Turns an element of the page into a real PDF file and downloads it — no library, nothing sent to a server.
// The browser itself draws the page (so Kurdish/Arabic letters are shaped correctly); the picture is cut into
// A4 pages and written into a small PDF file.

const A4_W = 595.28; // points
const A4_H = 841.89;
const MARGIN = 24;

/* ----------------------------- helpers ----------------------------- */

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

const dataUrlCache = new Map<string, Promise<string>>();
function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return Promise.resolve(url);
  let p = dataUrlCache.get(url);
  if (!p) {
    p = fetch(url, { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.blob();
      })
      .then(blobToDataUrl);
    dataUrlCache.set(url, p);
  }
  return p;
}

/** The @font-face rules of the page, with their font files embedded (an image of the page cannot load files). */
async function embeddedFontCss(): Promise<string> {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      let css = rule.cssText;
      const base = sheet.href || document.baseURI;
      const urls = Array.from(css.matchAll(/url\(["']?([^"')]+)["']?\)/g));
      let ok = true;
      for (const m of urls) {
        try {
          const abs = new URL(m[1], base).href;
          css = css.replace(m[0], `url("${await toDataUrl(abs)}")`);
        } catch {
          ok = false;
        }
      }
      if (ok) out.push(css);
    }
  }
  return out.join("\n");
}

/** Copy every computed style onto the clone (walking both trees together), so it looks the same outside the page. */
function inlineStyles(src: Element, dst: Element) {
  const cs = getComputedStyle(src);
  let text = "";
  for (let i = 0; i < cs.length; i++) {
    const name = cs[i];
    text += `${name}:${cs.getPropertyValue(name)};`;
  }
  (dst as HTMLElement).style.cssText = text;
  for (let i = 0; i < src.children.length; i++) inlineStyles(src.children[i], dst.children[i]);
}

async function inlineImages(src: Element, dst: Element) {
  const jobs: Promise<void>[] = [];
  const walk = (s: Element, d: Element) => {
    if (s instanceof HTMLImageElement && d instanceof HTMLImageElement) {
      const url = s.currentSrc || s.src;
      jobs.push(
        toDataUrl(url)
          .then((u) => {
            d.setAttribute("src", u);
            d.removeAttribute("srcset");
            d.removeAttribute("loading");
          })
          .catch(() => d.remove())
      );
    }
    const bg = (d as HTMLElement).style?.backgroundImage;
    const m = bg && bg.match(/url\(["']?([^"')]+)["']?\)/);
    if (m && !m[1].startsWith("data:")) {
      jobs.push(
        toDataUrl(new URL(m[1], document.baseURI).href)
          .then((u) => {
            (d as HTMLElement).style.backgroundImage = bg.replace(m[0], `url("${u}")`);
          })
          .catch(() => {
            (d as HTMLElement).style.backgroundImage = "none";
          })
      );
    }
    for (let i = 0; i < s.children.length; i++) walk(s.children[i], d.children[i]);
  };
  walk(src, dst);
  await Promise.all(jobs);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not draw the page"));
    img.src = url;
  });
}

/** Where to cut a page: the last blank row near the wanted position, so lines of text are not cut in half. */
function bestCut(ctx: CanvasRenderingContext2D, width: number, want: number, search: number): number {
  const from = Math.max(1, want - search);
  const rows = want - from;
  if (rows < 2) return want;
  const data = ctx.getImageData(0, from, width, rows).data;
  for (let y = rows - 1; y >= 0; y--) {
    const o = y * width * 4;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    let blank = true;
    for (let x = 0; x < width; x += 3) {
      const i = o + x * 4;
      if (Math.abs(data[i] - r) > 6 || Math.abs(data[i + 1] - g) > 6 || Math.abs(data[i + 2] - b) > 6) {
        blank = false;
        break;
      }
    }
    if (blank) return from + y;
  }
  return want;
}

/* ------------------------------ PDF file ------------------------------ */

type PageImage = { jpeg: Uint8Array; w: number; h: number; wPt: number; hPt: number };

function buildPdf(pages: PageImage[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const push = (d: Uint8Array | string) => {
    const b = typeof d === "string" ? enc.encode(d) : d;
    chunks.push(b);
    size += b.length;
  };
  const obj = (n: number, body: string, stream?: Uint8Array) => {
    offsets[n] = size;
    push(`${n} 0 obj\n${body}`);
    if (stream) {
      push("\nstream\n");
      push(stream);
      push("\nendstream");
    }
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  // 1 catalog, 2 pages, then per page: page, content, image
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  pages.forEach((p, i) => {
    const pg = 3 + i * 3;
    const x = (A4_W - p.wPt) / 2;
    const y = A4_H - MARGIN - p.hPt;
    const content = enc.encode(`q ${p.wPt.toFixed(2)} 0 0 ${p.hPt.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`);
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] /Resources << /XObject << /Im0 ${pg + 2} 0 R >> >> /Contents ${pg + 1} 0 R >>`);
    obj(pg + 1, `<< /Length ${content.length} >>`, content);
    obj(pg + 2, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>`, p.jpeg);
  });
  const count = 3 + pages.length * 3;
  const xref = size;
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n++) table += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  push(table + `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  const out = new Uint8Array(size);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

function dataUrlToBytes(url: string): Uint8Array {
  const bin = atob(url.slice(url.indexOf(",") + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ------------------------------- public ------------------------------- */

/** Draw `el` and save it as `fileName` (.pdf). Throws when the browser cannot do it (the caller can fall back to printing). */
export async function downloadElementAsPdf(el: HTMLElement, fileName: string): Promise<void> {
  if (document.fonts?.ready) await document.fonts.ready;
  const width = Math.ceil(el.getBoundingClientRect().width);
  const height = Math.ceil(el.scrollHeight);

  const clone = el.cloneNode(true) as HTMLElement;
  inlineStyles(el, clone);
  clone.style.margin = "0";
  clone.style.width = `${width}px`;
  clone.style.height = "auto";
  clone.style.boxShadow = "none";
  await inlineImages(el, clone); // (both trees must still match here)
  clone.querySelectorAll('[class*="print:hidden"]').forEach((n) => n.remove());

  const fonts = await embeddedFontCss().catch(() => "");
  const xhtml = new XMLSerializer().serializeToString(clone);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<style>${fonts.replace(/</g, "&lt;")}</style>` +
    `<foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));

  // keep the picture within what phones can handle (about 12 million pixels)
  const ratio = Math.min(2, Math.sqrt(12_000_000 / (width * height)));
  const cw = Math.round(width * ratio);
  const ch = Math.round(height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);

  // cut into A4 pages
  const scalePt = (A4_W - MARGIN * 2) / cw; // points per canvas pixel
  const pagePx = Math.floor((A4_H - MARGIN * 2) / scalePt);
  const pages: PageImage[] = [];
  let y = 0;
  while (y < ch) {
    let end = Math.min(ch, y + pagePx);
    if (end < ch) end = bestCut(ctx, cw, end, Math.round(pagePx * 0.15));
    if (end <= y) end = Math.min(ch, y + pagePx);
    const part = document.createElement("canvas");
    part.width = cw;
    part.height = end - y;
    const pctx = part.getContext("2d");
    if (!pctx) throw new Error("no canvas");
    pctx.fillStyle = "#ffffff";
    pctx.fillRect(0, 0, part.width, part.height);
    pctx.drawImage(canvas, 0, y, cw, end - y, 0, 0, cw, end - y);
    pages.push({
      jpeg: dataUrlToBytes(part.toDataURL("image/jpeg", 0.88)),
      w: part.width,
      h: part.height,
      wPt: cw * scalePt,
      hPt: (end - y) * scalePt,
    });
    y = end;
  }

  const bytes = buildPdf(pages);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.replace(/[\\/:*?"<>|]+/g, "_").replace(/\.pdf$/i, "") + ".pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** File name "CV - name - code - phone" (empty parts are left out). */
export function cvFileName(parts: { name?: string | null; code?: string | null; phone?: string | null }): string {
  return ["CV", parts.name, parts.code, parts.phone].map((p) => (p ?? "").toString().trim()).filter(Boolean).join(" - ");
}

/** Download as PDF; if this browser cannot draw the page, open the print window instead. Returns false when it fell back. */
export async function downloadPdfOrPrint(el: HTMLElement | null, fileName: string): Promise<boolean> {
  if (el) {
    try {
      await downloadElementAsPdf(el, fileName);
      return true;
    } catch {
      // fall through to printing
    }
  }
  const before = document.title;
  document.title = fileName;
  const restore = () => {
    document.title = before;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
  return false;
}
