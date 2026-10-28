"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/client";
import { useI18n } from "@/lib/i18n";

/** Settings: how many jobs one candidate may apply to (0 = no limit). */
export function ApplicationLimitCard() {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiClient
      .getApplicationLimit()
      .then((r) => setValue(String(r.maxApplications)))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setBusy(true);
    try {
      const r = await apiClient.setApplicationLimit(Number(value));
      setValue(String(r.maxApplications));
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div>
        <h3 className="font-semibold">{t("Applications per candidate")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("How many jobs one candidate can apply to from the candidate portal. Enter 0 for no limit.")}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="max-apps" className="text-xs">
            {t("Maximum jobs per candidate")}
          </Label>
          <Input id="max-apps" type="number" min={0} max={1000} dir="ltr" className="w-40" value={value} disabled={!loaded} onChange={(e) => setValue(e.target.value)} />
        </div>
        <Button onClick={save} disabled={busy || !loaded}>
          {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t("Save")}
        </Button>
      </div>
    </div>
  );
}
