"use client";

import { FormEvent, useEffect, useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { useOrg } from "@/lib/org-context";

/** Settings → Banner (administrators only): the name, version and copyright shown at the bottom of every page. */
export function BannerSettings() {
  const { t } = useI18n();
  const { org, setOrg } = useOrg();
  const [form, setForm] = useState({ bannerName: "", version: "", copyright: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({ bannerName: org.bannerName, version: org.version, copyright: org.copyright });
  }, [org]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const preview = [form.bannerName, form.version && `v${form.version.replace(/^v/i, "")}`, form.copyright].filter(Boolean).join("  ·  ");

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setOrg(await apiClient.updateOrg(form));
      toast.success("Banner updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Flag className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">{t("Banner")}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("Shown as a thin line at the bottom of every page. Leave a field empty to hide it.")}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bn-name">{t("Name")}</Label>
          <Input id="bn-name" value={form.bannerName} maxLength={100} onChange={(e) => set("bannerName")(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bn-version">{t("Version")}</Label>
          <Input id="bn-version" dir="ltr" value={form.version} maxLength={40} placeholder="1.0.0" onChange={(e) => set("version")(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="bn-copy">{t("Copyright")}</Label>
          <Input id="bn-copy" value={form.copyright} maxLength={200} placeholder="© 2026" onChange={(e) => set("copyright")(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-center text-xs text-muted-foreground" dir="auto">
        <p className="mb-1 font-medium">{t("Preview")}</p>
        {preview || "—"}
      </div>
      {error && (
        <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {t(error)}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t("Save changes")}
        </Button>
      </div>
    </form>
  );
}
