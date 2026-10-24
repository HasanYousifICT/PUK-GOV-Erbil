"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, ShieldAlert, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/components/shared";
import { useI18n } from "@/lib/i18n";

const KEY = "oroos_last_backup";

/** Settings → Backup (administrators only): download the database and every uploaded file as one ZIP. */
export function BackupSettings() {
  const { t } = useI18n();
  const [last, setLast] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  /** Send the backup ZIP; the system restarts afterwards, so wait until it answers again and reload. */
  function restore() {
    if (!file) return;
    setError(null);
    setBusy(true);
    setProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/restore");
    xhr.setRequestHeader("x-confirm", "RESTORE");
    xhr.setRequestHeader("Content-Type", "application/zip");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => {
      setBusy(false);
      setError("Upload failed");
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setDone(true);
        const poll = () =>
          fetch("/api/public/org", { cache: "no-store" })
            .then((r) => (r.ok ? (window.location.href = "/") : Promise.reject()))
            .catch(() => setTimeout(poll, 2500));
        setTimeout(poll, 4000);
      } else {
        setBusy(false);
        try {
          setError(JSON.parse(xhr.responseText).error ?? "Restore failed");
        } catch {
          setError("Restore failed");
        }
      }
    };
    xhr.send(file);
  }

  return (
    <div className="space-y-4">
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

    <div className="rounded-xl border border-red-200 bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-red-600" />
        <h2 className="font-semibold">{t("Restore backup")}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("Put a backup ZIP back: the database is replaced by the one in the file and the uploaded files are added. The old database is kept as a safety copy on the server. The system restarts and you sign in again with the accounts from the backup.")}
      </p>
      {done ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("Backup restored. The system is restarting… this page reloads by itself.")}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <Input ref={fileRef} type="file" accept=".zip,application/zip" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="space-y-1">
            <Label htmlFor="rs-confirm">{t("Type RESTORE to confirm")}</Label>
            <Input id="rs-confirm" dir="ltr" value={confirm} disabled={busy} onChange={(e) => setConfirm(e.target.value)} className="max-w-xs" />
          </div>
          {busy && <p className="text-sm text-muted-foreground">{t("Uploading… {n}%", { n: progress })}</p>}
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(error)}
            </div>
          )}
          <Button variant="destructive" disabled={busy || !file || confirm !== "RESTORE"} onClick={restore}>
            {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Upload className="me-2 h-4 w-4" />}
            {t("Restore backup")}
          </Button>
        </div>
      )}
    </div>
    </div>
  );
}
