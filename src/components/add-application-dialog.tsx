"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "@/lib/notify";
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
import { Candidate, Job, apiClient } from "@/lib/client";

import { useI18n } from "@/lib/i18n";
export function AddApplicationDialog({
  open,
  onOpenChange,
  defaultCandidateId,
  defaultJobId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCandidateId?: string;
  defaultJobId?: string;
  onCreated?: () => void;
}) {
  const { t } = useI18n();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateId, setCandidateId] = useState("");
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [openJobs, allCandidates] = await Promise.all([
        apiClient.listJobs("Open"),
        apiClient.listCandidates(),
      ]);
      setJobs(openJobs);
      setCandidates(allCandidates);
    } catch {
      setError("Could not load jobs and candidates");
    }
  }, []);

  useEffect(() => {
    if (open) {
      setError(null);
      load();
    }
  }, [open, load]);

  useEffect(() => {
    if (open) {
      setCandidateId(defaultCandidateId ?? "");
      setJobId(defaultJobId ?? "");
    }
  }, [open, defaultCandidateId, defaultJobId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!candidateId || !jobId) {
      setError("Please select both a candidate and a job");
      return;
    }
    setBusy(true);
    try {
      await apiClient.createApplication(candidateId, jobId);
      const candidate = candidates.find((c) => c.id === candidateId);
      toast.success(t("{name} added to pipeline (Applied)", { name: candidate?.name ?? t("Candidate") }));
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create application");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {t("Add Candidate to Job")}
          </DialogTitle>
          <DialogDescription>
            {t("The candidate enters the pipeline at the Applied stage.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label>{t("Candidate *")}</Label>
            <Select value={candidateId} onValueChange={setCandidateId}>
              <SelectTrigger aria-label={t("Select candidate")}>
                <SelectValue placeholder={t("Select a candidate")} />
              </SelectTrigger>
              <SelectContent className="max-h-64 thin-scrollbar">
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.email ? ` · ${c.email}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("Job *")}</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger aria-label={t("Select job")}>
                <SelectValue placeholder={t("Select an open job")} />
              </SelectTrigger>
              <SelectContent className="max-h-64 thin-scrollbar">
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title} · {j.location || t("Any location")}
                  </SelectItem>
                ))}
                {jobs.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">{t("No open jobs available")}</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(error)}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("Add to pipeline")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
