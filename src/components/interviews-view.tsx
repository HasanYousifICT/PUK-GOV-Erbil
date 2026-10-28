"use client";
import { JobTitleText } from "@/components/job-title-text";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Avatar,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  formatDate,
  InterviewStatusBadge,
  PageHeader,
  TableSkeleton,
  useLoadEffect,
} from "@/components/shared";
import { Interview, apiClient } from "@/lib/client";
import { NavState } from "@/components/app-shell";
import { InterviewFormDialog } from "@/components/interview-form-dialog";

import { useI18n } from "@/lib/i18n";
import { useCan } from "@/lib/permissions-context";
type Filter = "all" | "Scheduled" | "Completed" | "Cancelled";

export function InterviewsView({ onNavigate }: { onNavigate: (state: NavState) => void }) {
  const { t } = useI18n();
  const canEdit = useCan("interviews", "edit");
  const [interviews, setInterviews] = useState<Interview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Interview | null>(null);
  const [deleting, setDeleting] = useState<Interview | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setInterviews(await apiClient.listInterviews());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load interviews");
    }
  }, []);

  useLoadEffect(load);

  async function setStatus(interview: Interview, status: "Completed" | "Cancelled" | "Scheduled") {
    try {
      await apiClient.updateInterview(interview.id, { status });
      toast.success(t("Interview marked {status}", { status: t(status).toLowerCase() }));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update interview");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiClient.deleteInterview(deleting.id);
      toast.success("Interview deleted");
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete interview");
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtered = (interviews ?? []).filter((i) => (filter === "all" ? true : i.status === filter));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Interviews")}
        description={t("Schedule, track and capture feedback for candidate interviews.")}
        action={
          !canEdit ? undefined : <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <CalendarPlus className="me-2 h-4 w-4" />
            {t("Schedule Interview")}
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="all">{t("All")}</TabsTrigger>
          <TabsTrigger value="Scheduled">{t("Scheduled")}</TabsTrigger>
          <TabsTrigger value="Completed">{t("Completed")}</TabsTrigger>
          <TabsTrigger value="Cancelled">{t("Cancelled")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && <ErrorState message={error} onRetry={load} />}
      {!interviews && !error && <TableSkeleton rows={4} />}

      {interviews && filtered.length === 0 && !error && (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title={filter !== "all" ? t("No {status} interviews", { status: t(filter).toLowerCase() }) : t("No interviews scheduled")}
          description={
            filter !== "all"
              ? "Try a different status filter."
              : "Schedule interviews from here or directly from the Applications board."
          }
          action={
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <CalendarPlus className="me-2 h-4 w-4" /> {t("Schedule interview")}
            </Button>
          }
        />
      )}

      {interviews && filtered.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-start text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">{t("Candidate")}</th>
                  <th className="px-4 py-3 font-medium">{t("Job")}</th>
                  <th className="px-4 py-3 font-medium">{t("Interviewer")}</th>
                  <th className="px-4 py-3 font-medium">{t("When")}</th>
                  <th className="px-4 py-3 font-medium">{t("Status")}</th>
                  <th className="px-4 py-3 font-medium">{t("Feedback")}</th>
                  <th className="px-4 py-3 text-end font-medium">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((iv) => (
                  <tr key={iv.id} className="border-b transition-colors last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={iv.application?.candidate?.name ?? "?"} />
                        <span className="font-medium">{iv.application?.candidate?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="max-w-40 px-4 py-3">
                      <p className="truncate text-muted-foreground">{iv.application?.job ? <JobTitleText title={iv.application.job.title} /> : "—"}</p>
                    </td>
                    <td className="px-4 py-3">{iv.interviewer}</td>
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap">{formatDate(iv.date)}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {iv.time}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <InterviewStatusBadge status={iv.status} />
                    </td>
                    <td className="max-w-52 px-4 py-3">
                      <p className="truncate text-muted-foreground" title={iv.feedback}>
                        {iv.feedback || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={t("Actions for interview with {name}", { name: iv.application?.candidate?.name ?? "" })}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(iv);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="me-2 h-4 w-4" /> {t("Edit")}
                          </DropdownMenuItem>
                          {iv.status !== "Completed" && (
                            <DropdownMenuItem onClick={() => setStatus(iv, "Completed")}>
                              <CheckCircle2 className="me-2 h-4 w-4" /> {t("Mark completed")}
                            </DropdownMenuItem>
                          )}
                          {iv.status !== "Cancelled" && iv.status !== "Completed" && (
                            <DropdownMenuItem onClick={() => setStatus(iv, "Cancelled")}>
                              <XCircle className="me-2 h-4 w-4" /> {t("Cancel interview")}
                            </DropdownMenuItem>
                          )}
                          {iv.status === "Cancelled" && (
                            <DropdownMenuItem onClick={() => setStatus(iv, "Scheduled")}>
                              <CalendarDays className="me-2 h-4 w-4" /> {t("Reschedule (mark scheduled)")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleting(iv)}>
                            <Trash2 className="me-2 h-4 w-4" /> {t("Delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((iv) => (
              <div key={iv.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={iv.application?.candidate?.name ?? "?"} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{iv.application?.candidate?.name ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground"><JobTitleText title={iv.application?.job?.title} /></p>
                    </div>
                  </div>
                  <InterviewStatusBadge status={iv.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {formatDate(iv.date)} · {iv.time} · {iv.interviewer}
                  </span>
                  <span className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      aria-label={t("Edit interview")}
                      onClick={() => {
                        setEditing(iv);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {iv.status === "Scheduled" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-primary"
                          aria-label={t("Mark completed")}
                          onClick={() => setStatus(iv, "Completed")}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-600"
                          aria-label={t("Cancel interview")}
                          onClick={() => setStatus(iv, "Cancelled")}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-red-600"
                      aria-label={t("Delete interview")}
                      onClick={() => setDeleting(iv)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                </div>
                {iv.feedback && (
                  <p className="mt-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
                    “{iv.feedback}”
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <InterviewFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        interview={editing}
        onSaved={load}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("Delete this interview?")}
        description={t("The interview record and its feedback will be permanently removed.")}
        onConfirm={handleDelete}
        busy={deleteBusy}
      />
    </div>
  );
}
