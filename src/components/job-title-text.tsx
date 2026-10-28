"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/client";
import { useI18n } from "@/lib/i18n";

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
let cache: Map<string, string> | null = null;
let pending: Promise<void> | null = null;

function load(): Promise<void> {
  if (!pending) {
    pending = apiClient
      .listJobTitles()
      .then((rows) => {
        cache = new Map(rows.filter((r) => r.titleCkb).map((r) => [norm(r.title), r.titleCkb]));
      })
      .catch(() => {
        pending = null; // try again next time (for example before sign-in)
      });
  }
  return pending;
}

/** Name of a job title in the current language (Kurdish when one was written in the job-title list). */
export function useJobTitle(): (title: string | null | undefined, ckb?: string) => string {
  const { locale } = useI18n();
  const [, bump] = useState(0);
  useEffect(() => {
    if (locale === "ckb" && !cache) load().then(() => bump((n) => n + 1));
  }, [locale]);
  return (title, ckb) => {
    const en = title ?? "";
    if (locale !== "ckb") return en;
    return ckb || cache?.get(norm(en)) || en;
  };
}

/** A job title as text, in the current language. `ckb` is used when the server already sent it. */
export function JobTitleText({ title, ckb }: { title: string | null | undefined; ckb?: string }) {
  const jt = useJobTitle();
  return <>{jt(title, ckb)}</>;
}
