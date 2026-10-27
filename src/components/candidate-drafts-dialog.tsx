"use client";

import { useEffect, useState } from "react";
import { FileClock, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiClient, DraftRow } from "@/lib/client";
import type { DraftData } from "@/lib/candidate-drafts";
import { formatDate } from "@/components/shared";
import { useI18n } from "@/lib/i18n";

/** The user's saved (unfinished) candidates: continue one or delete it. */
export function CandidateDraftsDialog({
  open,
  onOpenChange,
  onResume,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onResume: (draft: { id: string; data: DraftData }) => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(null);
    apiClient.listCandidateDrafts().then(setRows).catch(() => setRows([]));
  }, [open]);

  async function resume(row: DraftRow) {
    setBusyId(row.id);
    try {
      const full = await apiClient.getCandidateDraft(row.id);
      onOpenChange(false);
      onResume({ id: full.id, data: full.data });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open the draft");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: DraftRow) {
    setBusyId(row.id);
    try {
      await apiClient.deleteCandidateDraft(row.id);
      setRows((r) => (r ?? []).filter((x) => x.id !== row.id));
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the draft");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileClock className="h-5 w-5 text-primary" />
            {t("Saved drafts")}
          </DialogTitle>
          <DialogDescription>{t("Candidates you started adding but have not finished. Only you can see your drafts.")}</DialogDescription>
        </DialogHeader>
        {!rows && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
        {rows && rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("No saved drafts.")}</p>}
        {rows && rows.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <button type="button" className="min-w-0 flex-1 text-start" onClick={() => resume(r)} disabled={busyId === r.id}>
                  <p className="truncate text-sm font-medium" dir="auto">{r.label || t("Untitled draft")}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.updatedAt)}</p>
                </button>
                <Button size="sm" variant="outline" onClick={() => resume(r)} disabled={busyId === r.id}>
                  {t("Continue")}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-600" aria-label={t("Delete")} onClick={() => remove(r)} disabled={busyId === r.id}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
