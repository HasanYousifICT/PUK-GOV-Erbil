// OpenRecruitOS — tiny i18n core (no React). English text is the key; any
// string missing from a dictionary simply falls back to the English original.

import { ckb } from "@/lib/locales/ckb";

export type Locale = "en" | "ckb";

export const LOCALES: { code: Locale; label: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "ckb", label: "کوردی سۆرانی", dir: "rtl" },
];

const STORAGE_KEY = "openrecruitos-lang";
const DICTIONARIES: Record<Locale, Record<string, string>> = { en: {}, ckb };

let currentLocale: Locale = "en";
let initialised = false;
const listeners = new Set<() => void>();

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ckb" ? "rtl" : "ltr";
}

function applyToDocument() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = currentLocale;
  document.documentElement.dir = dirOf(currentLocale);
}

function init() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ckb") currentLocale = saved;
  } catch {
    /* storage unavailable — stay on English */
  }
  applyToDocument();
}

export function getLocale(): Locale {
  init();
  return currentLocale;
}

export function getServerLocale(): Locale {
  return "en";
}

export function subscribeLocale(listener: () => void) {
  init();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLocale(next: Locale) {
  init();
  currentLocale = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  applyToDocument();
  listeners.forEach((l) => l());
}

export type Vars = Record<string, string | number>;

/** Translate `key` (the English text), substituting `{name}` placeholders. */
export function translate(key: string, vars?: Vars, locale: Locale = currentLocale): string {
  let text = DICTIONARIES[locale]?.[key] ?? key;
  if (vars) {
    text = text.replace(/\{(\w+)\}/g, (_, name: string) =>
      name in vars ? String(vars[name]) : `{${name}}`
    );
  }
  return text;
}
