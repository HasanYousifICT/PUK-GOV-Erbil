// One place for how dates and times look: dates as dd-mm-yyyy, times on a 12-hour clock with AM/PM.

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-01" → "01-11-2026" (anything else is returned as it is). */
export function isoToDmy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** "01-11-2026" → "2026-11-01", or "" when it is not a real date. */
export function dmyToIso(text: string): string {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text.trim());
  if (!m) return "";
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return "";
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** "13:05" → "01:05 PM". */
export function time12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
  if (!m) return hhmm ?? "";
  const h = Number(m[1]);
  return `${pad(h % 12 === 0 ? 12 : h % 12)}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** A date (yyyy-mm-dd text, ISO timestamp or Date) as dd-mm-yyyy. */
export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return isoToDmy(value);
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** A moment as "dd-mm-yyyy, hh:mm AM". */
export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return `${fmtDate(d)}, ${time12(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`;
}
