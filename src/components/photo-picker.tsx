"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/client";
import { useI18n } from "@/lib/i18n";

const MAX = 5 * 1024 * 1024;

/** Personal photo: shows the current picture and lets the person upload, replace or remove it. */
export function PhotoPicker({
  value,
  upload,
  onChange,
}: {
  value: string;
  upload: (file: File) => Promise<{ key: string }>;
  onChange: (key: string) => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) return setError("The photo must be a PNG, JPG or WebP image");
    if (file.size > MAX) return setError("The photo is too large (max 5 MB)");
    setBusy(true);
    try {
      onChange((await upload(file)).key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>{t("Personal photo")}</Label>
      <div className="flex items-center gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted text-muted-foreground">
          {value ? <img src={apiClient.resumeUrl(value)} alt={t("Personal photo")} className="h-full w-full object-cover" /> : <UserRound className="h-10 w-10" />}
        </div>
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => ref.current?.click()}>
              {busy ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Camera className="me-1.5 h-3.5 w-3.5" />}
              {value ? t("Change photo") : t("Upload photo")}
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onChange("")}>
                <Trash2 className="me-1.5 h-3.5 w-3.5" /> {t("Remove")}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("A clear face photo · PNG, JPG or WebP · max 5 MB. It is shown on the CV.")}</p>
        </div>
        <input
          ref={ref}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          capture="user"
          className="hidden"
          aria-label={t("Upload photo")}
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-xs text-red-600">{t(error)}</p>}
    </div>
  );
}
