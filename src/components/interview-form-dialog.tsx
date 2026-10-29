"use client";
import { JobTitleText } from "@/components/job-title-text";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { MAX_INTERVIEWERS, parseIds } from "@/lib/interview-rules";
import { Application, Interview, apiClient } from "@/lib/client";
import { INTERVIEW_STATUSES } from "@/lib/constants";

import { useI18n } from "@/lib/i18n";
export function InterviewFormDialog({
  open,
  onOpenChange,
  interview,
  presetApplicationId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interview?: Interview | null;
  presetApplicationId?: string;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [people, setPeople] = useState<{ id: string; name: string; title: string }[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [idsTouched, setIdsTouched] = useState(false);
  const [requireAll, setRequireAll] = useState(true);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  useEffect(() => {
    if (open) apiClient.listInterviewers().then(setPeople).catch(() => setPeople([]));
  }, [open]);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [status, setStatus] = useState("Scheduled");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [appSearch, setAppSearch] = useState("");
  const [chosen, setChosen] = useState<Application | null>(null);
  // an application chosen from outside (opened from the board) may not be among the search results
  useEffect(() => {
    if (!open || !presetApplicationId) return setChosen(null);
    apiClient.getApplication(presetApplicationId).then(setChosen).catch(() => setChosen(null));
  }, [open, presetApplicationId]);
  // search-as-you-type: the server returns at most 20 matching active applications
  useEffect(() => {
    if (!open || interview) return;
    let live = true;
    const id = setTimeout(() => {
      apiClient
        .listApplications({ status: "Active", q: appSearch.trim() || undefined, limit: 20 })
        .then((apps) => live && setApplications(apps))
        .catch(() => live && setError("Could not load applications"));
    }, appSearch ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [open, interview, appSearch]);

  useEffect(() => {
    if (open) {
      setError(null);
      setAppSearch("");
      setApplicationId(interview?.applicationId ?? presetApplicationId ?? "");
      setIds(parseIds(interview?.interviewerIds));
      setIdsTouched(false);
      setRequireAll(interview?.requireAll ?? true);
      setDoneIds(parseIds(interview?.doneIds));
      setDate(interview?.date ?? "");
      setTime(interview?.time ?? "");
      setStatus(interview?.status ?? "Scheduled");
      setFeedback(interview?.feedback ?? "");
    }
  }, [open, interview, presetApplicationId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!applicationId) {
      setError("Please select the application (candidate & job)");
      return;
    }
    const legacy = !!interview && parseIds(interview.interviewerIds).length === 0 && !idsTouched;
    if (!legacy && ids.length === 0) {
      setError("Choose at least one interviewer");
      return;
    }
    if (!date || !time) {
      setError("Date and time are required");
      return;
    }
    setBusy(true);
    try {
      if (interview) {
        await apiClient.updateInterview(interview.id, {
          ...(legacy ? {} : { interviewerIds: ids, requireAll, doneIds }),
          date,
          time,
          status,
          feedback,
        });
        toast.success("Interview updated");
      } else {
        await apiClient.createInterview({ applicationId, interviewerIds: ids, requireAll, date, time, feedback });
        toast.success("Interview scheduled");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save interview");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto thin-scrollbar sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{interview ? t("Edit Interview") : t("Schedule Interview")}</DialogTitle>
          <DialogDescription>
            {interview
              ? t("Update the interview details, status or feedback.")
              : t("Pick the candidate application, interviewer and schedule.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label>{t("Candidate & Job *")}</Label>
            {!interview && (
              <Input
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder={t("Search by name, phone or e-mail")}
                aria-label={t("Search by name, phone or e-mail")}
              />
            )}
            <Select
              value={applicationId}
              onValueChange={setApplicationId}
              disabled={!!interview}
            >
              <SelectTrigger aria-label={t("Select application")}>
                <SelectValue placeholder={t("Select candidate & job")} />
              </SelectTrigger>
              <SelectContent className="max-h-64 thin-scrollbar">
                {[...(chosen && !applications.some((a) => a.id === chosen.id) ? [chosen] : []), ...applications].map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.candidate?.name} — <JobTitleText title={a.job?.title} /> ({a.stage})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {interview && interview.application && (
              <p className="text-xs text-muted-foreground">
                {interview.application.candidate.name} — <JobTitleText title={interview.application.job.title} />
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="iv-date">{t("Date *")}</Label>
              <Input id="iv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iv-time">{t("Time *")}</Label>
              <Input id="iv-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("Interviewers *")}</Label>
            {interview && parseIds(interview.interviewerIds).length === 0 && !idsTouched && (
              <p className="text-xs text-muted-foreground">{interview.interviewer}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {ids.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-1 ps-3 pe-1 text-sm">
                  {nameOf(id)}
                  <button
                    type="button"
                    aria-label={t("Remove")}
                    className="rounded-full px-2 text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      setIds((l) => l.filter((x) => x !== id));
                      setDoneIds((l) => l.filter((x) => x !== id));
                      setIdsTouched(true);
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            {ids.length < MAX_INTERVIEWERS && (
              <SearchableSelect
                value={undefined}
                ariaLabel={t("Add an interviewer")}
                placeholder={ids.length ? t("Add another interviewer") : t("Select an interviewer")}
                options={people.filter((p) => !ids.includes(p.id)).map((p) => ({ value: p.id, label: p.title ? `${p.name} — ${p.title}` : p.name }))}
                onChange={(v) => {
                  if (v) {
                    setIds((l) => [...l, v]);
                    setIdsTouched(true);
                  }
                }}
              />
            )}
            {people.length === 0 && <p className="text-xs text-muted-foreground">{t("No user has interview access yet.")}</p>}
          </div>

          {ids.length > 1 && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <Label>{t("Who must interview the candidate?")}</Label>
              <Select value={requireAll ? "all" : "one"} onValueChange={(v) => setRequireAll(v === "all")}>
                <SelectTrigger aria-label={t("Who must interview the candidate?")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("Both / all of them must interview")}</SelectItem>
                  <SelectItem value="one">{t("One of them is enough")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {interview && ids.length > 0 && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <Label>{t("Interviewed")}</Label>
              {ids.map((id) => (
                <label key={id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={doneIds.includes(id)}
                    onCheckedChange={(c) => setDoneIds((l) => (c ? [...new Set([...l, id])] : l.filter((x) => x !== id)))}
                  />
                  {nameOf(id)}
                </label>
              ))}
              <p className="text-xs text-muted-foreground">
                {t("The interview becomes Completed when the required interviewers are ticked.")}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("Status")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label={t("Interview status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVIEW_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="iv-feedback">{t("Feedback / Comments")}</Label>
            <Textarea
              id="iv-feedback"
              rows={3}
              placeholder={t("Interview feedback, impressions, follow-ups…")}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
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
              {interview ? t("Save changes") : t("Schedule interview")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
