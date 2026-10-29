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
import { MAX_INTERVIEWERS, parseEvaluations, parseIds } from "@/lib/interview-rules";
import { Application, Interview, apiClient } from "@/lib/client";
import { INTERVIEW_STATUSES } from "@/lib/constants";

import { useI18n } from "@/lib/i18n";
import { useCanInterview } from "@/lib/permissions-context";
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
  const canSchedule = useCanInterview("schedule") || !interview;
  const canFeedback = useCanInterview("feedback");
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [people, setPeople] = useState<{ id: string; name: string; title: string }[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [idsTouched, setIdsTouched] = useState(false);
  const [requireAll, setRequireAll] = useState(true);
  type Ev = { comment: string; suitable: "" | "yes" | "no"; rating: string };
  const [evals, setEvals] = useState<Record<string, Ev>>({});
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  useEffect(() => {
    if (open) apiClient.me().then((u) => setMe({ id: u.id, role: u.role })).catch(() => setMe(null));
  }, [open]);
  const canWrite = (id: string) => !!me && (me.role === "admin" || me.id === id);
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
      const stored = parseEvaluations(interview?.evaluations);
      setEvals(
        Object.fromEntries(
          Object.entries(stored).map(([k, e]) => [k, { comment: e.comment, suitable: e.suitable ? "yes" : "no", rating: e.rating ? String(e.rating) : "" } as Ev])
        )
      );
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
    // evaluations written by the signed-in interviewer (or any, for an administrator)
    const evalPayload: Record<string, { comment: string; suitable: boolean; rating: number | null }> = {};
    if (interview && !legacy) {
      for (const id of ids) {
        const e = evals[id];
        if (!e || !e.suitable || !canWrite(id)) continue;
        if (e.suitable === "yes" && !e.rating) {
          setError("Give a rating from 1 to 10");
          return;
        }
        evalPayload[id] = { comment: e.comment, suitable: e.suitable === "yes", rating: e.suitable === "yes" ? Number(e.rating) : null };
      }
    }
    setBusy(true);
    try {
      if (interview) {
        await apiClient.updateInterview(interview.id, {
          ...(canSchedule
            ? { ...(legacy ? {} : { interviewerIds: ids, requireAll }), date, time, ...(status === "Completed" && !legacy ? {} : { status }) }
            : {}),
          ...(canFeedback ? { ...(legacy ? {} : { evaluations: evalPayload }), feedback } : {}),
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
              <Input id="iv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required disabled={!canSchedule} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iv-time">{t("Time *")}</Label>
              <Input id="iv-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required disabled={!canSchedule} />
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
                    disabled={!canSchedule}
                    aria-label={t("Remove")}
                    className="rounded-full px-2 text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      setIds((l) => l.filter((x) => x !== id));
                                      setIdsTouched(true);
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            {canSchedule && ids.length < MAX_INTERVIEWERS && (
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
              <Select value={requireAll ? "all" : "one"} onValueChange={(v) => setRequireAll(v === "all")} disabled={!canSchedule}>
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
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div>
                <Label>{t("Interviewer evaluations")}</Label>
                <p className="text-xs text-muted-foreground">
                  {ids.length > 1 && !requireAll
                    ? t("The interview becomes Completed automatically when one interviewer submits.")
                    : t("The interview becomes Completed automatically when all required interviewers submit.")}
                </p>
              </div>
              {ids.map((id) => {
                const e: Ev = evals[id] ?? { comment: "", suitable: "", rating: "" };
                const mine = canWrite(id) && canFeedback;
                const setE = (patch: Partial<Ev>) => setEvals((m) => ({ ...m, [id]: { ...e, ...patch } }));
                return (
                  <div key={id} className="space-y-2 rounded-md border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{nameOf(id)}</span>
                      <span className={`text-xs ${e.suitable ? "text-emerald-700" : "text-muted-foreground"}`}>
                        {e.suitable ? t("Submitted") : t("Waiting")}
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">{t("Is the candidate suitable?")}</Label>
                        <Select
                          disabled={!mine}
                          value={e.suitable || undefined}
                          onValueChange={(v) => setE({ suitable: v as "yes" | "no", rating: v === "no" ? "" : e.rating })}
                        >
                          <SelectTrigger aria-label={t("Is the candidate suitable?")}>
                            <SelectValue placeholder={t("Select")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">{t("Suitable")}</SelectItem>
                            <SelectItem value="no">{t("Not suitable")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {e.suitable === "yes" && (
                        <div className="space-y-1">
                          <Label className="text-xs">{t("Rating (1–10)")}</Label>
                          <Select disabled={!mine} value={e.rating || undefined} onValueChange={(v) => setE({ rating: v })}>
                            <SelectTrigger aria-label={t("Rating (1–10)")}>
                              <SelectValue placeholder={t("Select")} />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 10 }, (_, k) => String(k + 1)).map((n) => (
                                <SelectItem key={n} value={n}>
                                  {n}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <Textarea
                      rows={2}
                      disabled={!mine}
                      placeholder={t("Comments / feedback")}
                      value={e.comment}
                      onChange={(ev) => setE({ comment: ev.target.value })}
                    />
                    {!mine && <p className="text-xs text-muted-foreground">{t("Only this interviewer can write this evaluation.")}</p>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("Status")}</Label>
            <Select value={status} onValueChange={setStatus} disabled={!canSchedule}>
              <SelectTrigger aria-label={t("Interview status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVIEW_STATUSES.filter((s) => s !== "Completed" || !interview || parseIds(interview.interviewerIds).length === 0 || interview.status === "Completed").map((s) => (
                  <SelectItem key={s} value={s} disabled={s === "Completed" && !!interview && parseIds(interview.interviewerIds).length > 0}>
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
              disabled={!canFeedback}
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
