"use client";

import { useEffect, useState } from "react";
import { Download, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/components/shared";
import { useI18n } from "@/lib/i18n";

const KEY = "oroos_last_backup";

/** Settings → Backup (administrators only): download the database and every uploaded file as one ZIP. */
export function BackupSettings() {
  const { t } = useI18n();
  const [last, setLast] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLast(localStorage.getItem(KEY));
    } catch {
      // storage unavailable: just don't show the date
    }
  }, []);

  function download() {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(KEY, now);
    } catch {
      // ignore
    }
    setLast(now);
    window.location.href = "/api/backup";
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">{t("Backup")}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("Download one ZIP file with the whole database (candidates, jobs, accounts, settings) and every uploaded file (CVs, photos, documents). Keep a copy on your own device and repeat it regularly.")}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={download}>
          <Download className="me-2 h-4 w-4" />
          {t("Download backup")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {last ? t("Last downloaded from this browser: {date}", { date: formatDateTime(last) }) : t("Not downloaded from this browser yet")}
        </span>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{t("The file contains personal data of candidates. Keep it private and never share it.")}</p>
      </div>
    </div>
  );
}
