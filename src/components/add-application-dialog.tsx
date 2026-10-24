"use client";
import { JobPicker } from "@/components/job-picker";

import { CandidatePicker } from "@/components/candidate-picker";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
import { CategoryPicker, categoryPathText, useCategories } from "@/components/category-picker";
import { descendantIds } from "@/lib/categories";
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
  const { t, locale } = useI18n();
  const { index: catIndex } = useCategories();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCandidateId(defaultCandidateId ?? "");
      setJobId(defaultJobId ?? "");
      setCategoryId(null);
    }
  }, [open, defaultCandidateId, defaultJobId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!categoryId && !defaultJobId) {
      setError("Please choose a job classification");
      return;
    }
    if (!candidateId || !jobId) {
      setError("Please select both a candidate and a job");
      return;
    }
    setBusy(true);
    try {
      await apiClient.createApplication(candidateId, jobId);
            toast.success(t("{name} added to pipeline (Applied)", { name: pickedName || t("Candidate") }));
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
            <CandidatePicker value={candidateId} onChange={(id, c) => { setCandidateId(id); setPickedName(c?.name ?? ""); }} />
          </div>

          <div className="space-y-2">
            <Label>{t("Job classification")} *</Label>
            <CategoryPicker
              value={categoryId}
              onChange={(id) => {
                setCategoryId(id);
                setJobId("");
              }}
              index={catIndex}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("Job *")}</Label>
            <JobPicker
              value={jobId}
              onChange={(id) => setJobId(id)}
              status="Open"
              categoryId={defaultJobId ? null : categoryId}
              disabled={!categoryId && !defaultJobId}
            />
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
