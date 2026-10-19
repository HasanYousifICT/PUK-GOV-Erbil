// Phone numbers: cleaning + a canonical key used to detect duplicates.
// "0750 123 4567", "+964 750 123 4567" and "٠٧٥٠١٢٣٤٥٦٧" all give the same key.

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function asciiDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (ch) => {
    const a = ARABIC_DIGITS.indexOf(ch);
    return String(a >= 0 ? a : PERSIAN_DIGITS.indexOf(ch));
  });
}

/** Phone as stored/shown: ASCII digits, optional leading +, no spaces or punctuation. */
export function cleanPhone(raw: string): string {
  const s = asciiDigits(raw.trim());
  const plus = s.startsWith("+") || s.startsWith("00");
  const digits = s.replace(/\D/g, "").replace(/^00/, "");
  return digits ? (plus ? "+" : "") + digits : "";
}

/** Same person, different spelling → same key (last 10 digits; shorter numbers use all digits). */
export function phoneKey(raw: string): string {
  const digits = asciiDigits(raw).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** 7–15 digits, as in E.164. */
export function isValidPhone(raw: string): boolean {
  const n = asciiDigits(raw).replace(/\D/g, "").length;
  return n >= 7 && n <= 15;
}
