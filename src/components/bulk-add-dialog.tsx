"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient, BulkAddResult, Job } from "@/lib/client";
import { useI18n } from "@/lib/i18n";

export function BulkAddToJobDialog({
  open,
  onOpenChange,
  candidateIds,
  jobs,
  onDone,
  onOpenBoard,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  candidateIds: string[];
  jobs: Job[];
  onDone: () => void;
  onOpenBoard: () => void;
}) {
  const { t } = useI18n();
  const openJobs = jobs.filter((j) => j.status === "Open");
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkAddResult | null>(null);

  useEffect(() => {
    if (open) {
      setJobId("");
      setError(null);
      setResult(null);
    }
  }, [open]);

  async function submit() {
    if (!jobId) {
      setError("Select a job");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await apiClient.bulkAddToJob(candidateIds, jobId));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Add {n} candidates to a job", { n: candidateIds.length })}</DialogTitle>
          <DialogDescription>
            {t("They will be added to the “Applied” stage. Candidates already on the job are skipped.")}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {t("{n} candidates added to “{job}”", { n: result.created, job: result.jobTitle })}
                </p>
                {result.skipped > 0 && (
                  <p>{t("{n} were already on this job and were skipped", { n: result.skipped })}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("Close")}
              </Button>
              <Button onClick={onOpenBoard}>{t("Open applications board")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("Job")}</Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger aria-label={t("Job")}>
                  <SelectValue placeholder={t("Select a job")} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {openJobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {openJobs.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("There are no open jobs. Create or reopen a job first.")}</p>
              )}
            </div>
            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {t(error)}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                {t("Cancel")}
              </Button>
              <Button onClick={submit} disabled={busy || openJobs.length === 0}>
                {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("Add to job")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
