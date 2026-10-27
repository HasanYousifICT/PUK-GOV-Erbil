// Staff drafts of the "Add candidate" form: shared helpers (server + client).

export const MAX_DRAFTS = 50;

export type DraftData = {
  form: Record<string, string>;
  custom: Record<string, unknown>;
};

const FORM_KEYS = [
  "name", "email", "phone", "skills", "experience", "education", "location", "salary",
  "noticePeriod", "notes", "tags", "resume", "resumeName", "photo",
] as const;

/** Keep only the known form keys (as short strings) and the custom answers; never trust the client's shape. */
export function cleanDraftData(input: unknown): DraftData {
  const src = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const f = src.form && typeof src.form === "object" && !Array.isArray(src.form) ? (src.form as Record<string, unknown>) : {};
  const form: Record<string, string> = {};
  for (const k of FORM_KEYS) if (typeof f[k] === "string") form[k] = (f[k] as string).slice(0, 5000);
  const c = src.custom && typeof src.custom === "object" && !Array.isArray(src.custom) ? (src.custom as Record<string, unknown>) : {};
  const custom = JSON.stringify(c).length > 200_000 ? {} : c;
  return { form, custom };
}

/** A short name for the drafts list: the candidate's name, else phone / e-mail. */
export function draftLabel(data: DraftData, fallback = ""): string {
  const f = data.form;
  return (f.name || f.phone || f.email || fallback).trim().slice(0, 100);
}
