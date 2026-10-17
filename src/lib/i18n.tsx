"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  dirOf,
  getLocale,
  getServerLocale,
  Locale,
  LOCALES,
  setLocale,
  subscribeLocale,
  translate,
  Vars,
} from "@/lib/i18n-core";

type I18nContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Vars) => string;
};

const fallback: I18nContextValue = {
  locale: "en",
  dir: "ltr",
  setLocale,
  t: (key, vars) => translate(key, vars, "en"),
};

const I18nContext = createContext<I18nContextValue>(fallback);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getServerLocale);
  const t = useCallback((key: string, vars?: Vars) => translate(key, vars, locale), [locale]);
  const value = useMemo<I18nContextValue>(
    () => ({ locale, dir: dirOf(locale), setLocale, t }),
    [locale, t]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Dropdown that lets the user switch the interface language. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale: change } = useI18n();
  const current = LOCALES.find((l) => l.code === locale);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className} aria-label="Language / زمان">
          <Languages className="h-4 w-4" />
          <span>{current?.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={locale} onValueChange={(v) => change(v as Locale)}>
          {LOCALES.map((l) => (
            <DropdownMenuRadioItem key={l.code} value={l.code} lang={l.code}>
              {l.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
