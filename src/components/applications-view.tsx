"use client";
import { JobTitleText } from "@/components/job-title-text";
import { SearchableSelect } from "@/components/searchable-select";
import { useJobTitles } from "@/components/job-titles";
import { useJobTitle } from "@/components/job-title-text";

import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  CalendarDays,
  ClipboardList,
  Clock,
  GripVertical,
  MoreHorizontal,
  Plus,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { CategoryFilter, useCategories } from "@/components/category-picker";
import { descendantIds } from "@/lib/categories";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ALL_STAGES,
  REJECTED_STAGE,
  STAGES,
  STAGE_STYLES,
} from "@/lib/constants";
import { Application, apiClient, JobLite } from "@/lib/client";
import { NavState } from "@/components/app-shell";
import { AddApplicationDialog } from "@/components/add-application-dialog";
import { InterviewFormDialog } from "@/components/interview-form-dialog";
import {
  Avatar,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  formatDate,
  formatDateTime,
  InterviewStatusBadge,
  PageHeader,
  StageBadge,
  useLoadEffect,
} from "@/components/shared";
import { cn } from "@/lib/utils";

import { useI18n } from "@/lib/i18n";
import { useCan } from "@/lib/permissions-context";
/* --------------------------------- card --------------------------------- */

function ApplicationCard({
  app,
  onView,
  onSchedule,
  onMove,
  onRemove,
  dragging = false,
  overlay = false,
}: {
  app: Application;
  onView: () => void;
  onSchedule: () => void;
  onMove: (stage: string) => void;
  onRemove: () => void;
  dragging?: boolean;
  overlay?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm transition-shadow",
        overlay ? "w-64 rotate-1 shadow-lg" : "hover:shadow-md",
        dragging && "kanban-card-dragging"
      )}
    >
      <div className="flex items-start gap-2">
        <Avatar name={app.candidate?.name ?? "?"} className="h-8 w-8 text-[10px]" />
        <div className="min-w-0 flex-1">
          <button
            className="block max-w-full truncate text-start text-sm font-medium underline-offset-2 hover:underline"
            onClick={onView}
            title={app.candidate?.name}
          >
            {app.candidate?.name ?? "Unknown"}
          </button>
          <p className="truncate text-xs text-muted-foreground" title={app.job?.title}>
            {app.job ? <JobTitleText title={app.job.title} /> : "—"}
          </p>
        </div>
        {!overlay && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground"
                aria-label={t("Actions for {name}", { name: app.candidate?.name ?? "" })}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onView}>{t("View details")}</DropdownMenuItem>
              <DropdownMenuItem onClick={onSchedule}>
                <CalendarDays className="me-2 h-4 w-4" /> {t("Schedule interview")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Clock className="me-2 h-4 w-4" /> {t("Move to stage")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-72 thin-scrollbar">
                  {ALL_STAGES.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      disabled={s === app.stage}
                      onClick={() => onMove(s)}
                    >
                      {t(s)}
                      {s === app.stage && <span className="ms-auto text-xs text-muted-foreground">{t("current")}</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={onRemove}>
                <Trash2 className="me-2 h-4 w-4" /> {t("Remove application")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDate(app.appliedAt)}
        </span>
        {(app.interviews?.length ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {t(app.interviews!.length === 1 ? "{n} interview" : "{n} interviews", { n: app.interviews!.length })}
          </span>
        )}
      </div>
    </div>
  );
}

function DraggableCard(props: {
  app: Application;
  onView: () => void;
  onSchedule: () => void;
  onMove: (stage: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.app.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn(isDragging && "opacity-40")}>
      <div className="group relative">
        <span className="absolute -start-0.5 top-1/2 hidden -translate-y-1/2 cursor-grab text-muted-foreground/50 md:block">
          <GripVertical className="h-4 w-4" />
        </span>
        <ApplicationCard {...props} dragging={isDragging} />
      </div>
    </div>
  );
}

/* --------------------------------- column -------------------------------- */

function KanbanColumn({
  stage,
  apps,
  total,
  onLoadMore,
  onView,
  onSchedule,
  onMove,
  onRemove,
}: {
  stage: string;
  apps: Application[];
  total: number;
  onLoadMore: () => void;
  onView: (app: Application) => void;
  onSchedule: (app: Application) => void;
  onMove: (app: Application, stage: string) => void;
  onRemove: (app: Application) => void;
}) {
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const isRejected = stage === REJECTED_STAGE;

  return (
    <div className="flex w-[280px] shrink-0 flex-col rounded-xl border bg-muted/30 md:w-[300px]">
      <div className="flex items-center justify-between gap-2 border-b bg-card/60 px-3 py-2.5 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              stage === "Hired"
                ? "bg-emerald-500"
                : stage === "Selected"
                  ? "bg-teal-400"
                  : stage === "Interview"
                    ? "bg-blue-400"
                    : stage === "Screening"
                      ? "bg-sky-400"
                      : stage === "Rejected"
                        ? "bg-red-400"
                        : "bg-slate-300"
            )}
          />
          <h3 className="text-sm font-semibold">{t(stage)}</h3>
          <span
            className={cn(
              "rounded-full border px-1.5 py-px text-[11px] font-medium tabular-nums",
              STAGE_STYLES[stage] ?? "bg-slate-100 text-slate-600 border-slate-200"
            )}
          >
            {total}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex max-h-[calc(100vh-320px)] min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2 thin-scrollbar",
          isOver && "bg-sky-50/60 ring-2 ring-inset ring-sky-300 rounded-b-xl"
        )}
        aria-label={t("{stage} column with {n} applications", { stage: t(stage), n: total })}
      >
        {apps.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
            {isRejected ? t("No rejected candidates") : t("Drop candidates here")}
          </div>
        ) : (
          apps.map((app) => (
            <DraggableCard
              key={app.id}
              app={app}
              onView={() => onView(app)}
              onSchedule={() => onSchedule(app)}
              onMove={(s) => onMove(app, s)}
              onRemove={() => onRemove(app)}
            />
          ))
        )}
        {apps.length < total && (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onLoadMore}>
            {t("Load more")} ({total - apps.length})
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ detail dialog ----------------------------- */

function ApplicationDetailDialog({
  app,
  onClose,
  onChanged,
  onScheduleInterview,
  onNavigate,
}: {
  app: Application | null;
  onClose: () => void;
  onChanged: () => void;
  onScheduleInterview: (app: Application) => void;
  onNavigate: (state: NavState) => void;
}) {
  const { t } = useI18n();
  const [removing, setRemoving] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);

  if (!app) return null;

  async function move(stage: string) {
    if (!app) return;
    try {
      await apiClient.moveApplication(app.id, stage);
      toast.success(t("Moved to {stage}", { stage: t(stage) }));
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not move candidate");
    }
  }

  async function handleRemove() {
    if (!app) return;
    setRemoveBusy(true);
    try {
      await apiClient.deleteApplication(app.id);
      toast.success("Application removed");
      setRemoveBusy(false);
      onClose();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove application");
      setRemoveBusy(false);
    }
  }

  return (
    <Dialog open={!!app} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto thin-scrollbar sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar name={app.candidate?.name ?? "?"} />
            <span className="min-w-0">
              <span className="block truncate">{app.candidate?.name}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                <JobTitleText title={app.job?.title} />
              </span>
            </span>
          </DialogTitle>
          <DialogDescription>{t("Application details, stage history and interviews.")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-lg border p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Candidate")}</p>
            <p className="font-medium">{app.candidate?.name}</p>
            <p className="text-muted-foreground">{app.candidate?.email || t("No email")}</p>
            <p className="text-muted-foreground">{app.candidate?.phone || t("No phone")}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onNavigate({ view: "candidate-detail", candidateId: app.candidateId });
                }}
              >
                {t("View profile")}
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Application")}</p>
            <p>
              <span className="text-muted-foreground">{t("Applied:")}</span>{" "}
              {formatDate(app.appliedAt)}
            </p>
            <p>
              <span className="text-muted-foreground">{t("Current stage:")}</span>{" "}
              <StageBadge stage={app.stage} className="ms-1" />
            </p>
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs text-muted-foreground">{t("Move to stage")}</Label>
              <Select value={app.stage} onValueChange={move}>
                <SelectTrigger size="sm" aria-label={t("Move to stage")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STAGES.map((s) => (
                    <SelectItem key={s} value={s} disabled={s === app.stage}>
                      {t(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={() => onScheduleInterview(app)}>
                <CalendarDays className="me-1.5 h-3.5 w-3.5" /> {t("Schedule interview")}
              </Button>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="rounded-lg border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("Stage History")}
          </p>
          {app.history && app.history.length > 0 ? (
            <ol className="mt-2 space-y-2">
              {app.history.map((h) => (
                <li key={h.id} className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  {h.previousStage ? (
                    <span>
                      {h.previousStage} <span aria-hidden>→</span> <StageBadge stage={h.newStage} className="mx-0.5" />
                    </span>
                  ) : (
                    <span>
                      {t("Applied")} <span aria-hidden>→</span> <StageBadge stage={h.newStage} className="mx-0.5" />
                    </span>
                  )}
                  <span className="ms-auto text-xs text-muted-foreground">{formatDateTime(h.changedAt)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{t("No history recorded.")}</p>
          )}
        </div>

        {/* Interviews */}
        <div className="rounded-lg border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("Interviews ({n})", { n: app.interviews?.length ?? 0 })}
          </p>
          {(app.interviews?.length ?? 0) === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("No interviews scheduled yet.")}</p>
          ) : (
            <div className="mt-2 space-y-2">
              {app.interviews!.map((iv) => (
                <div key={iv.id} className="rounded-lg border p-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{iv.interviewer}</span>
                    <InterviewStatusBadge status={iv.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("{date} at {time}", { date: formatDate(iv.date), time: iv.time })}
                  </p>
                  {iv.feedback && (
                    <p className="mt-1.5 rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
                      “{iv.feedback}”
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-600" onClick={() => setRemoving(true)}>
            <Trash2 className="me-2 h-4 w-4" /> {t("Remove application")}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t("Close")}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={t("Remove this application?")}
        description={t("{name} will be removed from “{job}” along with its interviews and history.", { name: app.candidate?.name ?? t("This candidate"), job: app.job?.title ?? "" })}
        onConfirm={handleRemove}
        busy={removeBusy}
      />
    </Dialog>
  );
}

/* --------------------------------- board --------------------------------- */

export function ApplicationsView({
  onNavigate,
  focusApplicationId,
}: {
  onNavigate: (state: NavState) => void;
  focusApplicationId?: string;
}) {
  const { t } = useI18n();
  const canEdit = useCan("applications", "edit");
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobFilter, setJobFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [titleFilter, setTitleFilter] = useState("");
  const [specFilter, setSpecFilter] = useState<"any" | "yes" | "no">("any");
  const [noteFilter, setNoteFilter] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState<"any" | "Open" | "Closed">("any");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const { list: titleList } = useJobTitles();
  const jobTitle = useJobTitle();
  const { locale } = useI18n();
  const [notes, setNotes] = useState<string[]>([]);
  const [jobOptions, setJobOptions] = useState<JobLite[]>([]);
  useEffect(() => {
    if (specFilter === "yes") apiClient.jobSpecialists().then(setNotes).catch(() => setNotes([]));
  }, [specFilter]);
  // the job dropdown only lists jobs that match the filters chosen before it
  useEffect(() => {
    let live = true;
    apiClient
      .searchJobs({
        categoryId: categoryFilter ?? undefined,
        title: titleFilter || undefined,
        specialist: specFilter === "any" ? undefined : specFilter,
        specialistNote: specFilter === "yes" ? noteFilter || undefined : undefined,
        status: jobStatusFilter === "any" ? undefined : jobStatusFilter,
        limit: 100,
      })
      .then((r) => live && setJobOptions(r))
      .catch(() => live && setJobOptions([]));
    return () => {
      live = false;
    };
  }, [categoryFilter, titleFilter, specFilter, noteFilter, jobStatusFilter]);
  const { index: catIndex } = useCategories();
  const [addOpen, setAddOpen] = useState(false);
  const [detailAppId, setDetailAppId] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Application | null>(null);
  const [dragApp, setDragApp] = useState<Application | null>(null);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [searchKey, setSearchKey] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setSearchKey(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.listBoard({
        jobId: jobFilter !== "all" ? jobFilter : undefined,
        categoryId: categoryFilter ?? undefined,
        title: titleFilter || undefined,
        specialist: specFilter === "any" ? undefined : specFilter,
        specialistNote: specFilter === "yes" ? noteFilter || undefined : undefined,
        jobStatus: jobStatusFilter === "any" ? undefined : jobStatusFilter,
        from: fromDate || undefined,
        to: toDate || undefined,
        q: searchKey || undefined,
      });
      setApps(res.items);
      setCounts(res.counts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load applications");
    }
  }, [jobFilter, categoryFilter, titleFilter, specFilter, noteFilter, jobStatusFilter, fromDate, toDate, searchKey]);

  useLoadEffect(load);

  /** Append the next batch of one column. */
  async function loadMore(stage: string) {
    try {
      const have = (apps ?? []).filter((a) => a.stage === stage).length;
      const res = await apiClient.listBoard({
        jobId: jobFilter !== "all" ? jobFilter : undefined,
        categoryId: categoryFilter ?? undefined,
        title: titleFilter || undefined,
        specialist: specFilter === "any" ? undefined : specFilter,
        specialistNote: specFilter === "yes" ? noteFilter || undefined : undefined,
        jobStatus: jobStatusFilter === "any" ? undefined : jobStatusFilter,
        from: fromDate || undefined,
        to: toDate || undefined,
        q: searchKey || undefined,
        stage,
        offset: have,
      });
      setApps((prev) => {
        const seen = new Set((prev ?? []).map((a) => a.id));
        return [...(prev ?? []), ...res.items.filter((a) => !seen.has(a.id))];
      });
      setCounts(res.counts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load applications");
    }
  }

  // The open detail dialog always reflects the freshest application data
  const detailApp = detailAppId ? (apps ?? []).find((a) => a.id === detailAppId) ?? null : null;

  const filtered = apps ?? [];
  const totalApps = Object.values(counts).reduce((x: number, y: number) => x + y, 0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  async function moveApplication(app: Application, stage: string) {
    if (app.stage === stage) return;
    try {
      await apiClient.moveApplication(app.id, stage);
      toast.success(
        t("{name} moved to {stage}", { name: app.candidate?.name ?? t("Candidate"), stage: t(stage) }),
        { description: app.job?.title ?? "" }
      );
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not move candidate");
    }
  }

  function onDragStart(event: unknown) {
    const e = event as { active: { id: string | number } };
    if (apps) {
      const app = apps.find((a) => a.id === e.active.id) ?? null;
      setDragApp(app);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    setDragApp(null);
    const { active, over } = event;
    if (!over || !apps) return;
    const app = apps.find((a) => a.id === active.id);
    if (!app) return;
    const targetStage = String(over.id);
    if (ALL_STAGES.includes(targetStage as (typeof ALL_STAGES)[number])) {
      await moveApplication(app, targetStage);
    }
  }

  const boardStages = [...STAGES, REJECTED_STAGE];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Applications")}
        description={t("Drag candidates across the pipeline, or use the card menu on touch devices.")}
        action={
          !canEdit ? undefined : <Button onClick={() => setAddOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("Add Candidate to Job")}
          </Button>
        }
      />

      <div className="space-y-3 rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search by name, phone or e-mail")}
            aria-label={t("Search by name, phone or e-mail")}
            className="w-full lg:w-72"
          />
          <CategoryFilter
            value={categoryFilter}
            onChange={(id) => {
              setCategoryFilter(id);
              setJobFilter("all");
            }}
            index={catIndex}
          />
          <p className="text-sm text-muted-foreground lg:ms-auto">
            {t(totalApps === 1 ? "{n} application" : "{n} applications", { n: totalApps })}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("Job title")}</Label>
            <SearchableSelect
              value={titleFilter || undefined}
              ariaLabel={t("Job title")}
              noneLabel={t("All job titles")}
              options={(titleList ?? []).map((r) => ({ value: r.title, label: locale === "ckb" && r.titleCkb ? r.titleCkb : r.title }))}
              onChange={(v) => {
                setTitleFilter(v ?? "");
                setJobFilter("all");
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("Specialist")}</Label>
            <Select
              value={specFilter}
              onValueChange={(v) => {
                setSpecFilter(v as "any" | "yes" | "no");
                setNoteFilter("");
                setJobFilter("all");
              }}
            >
              <SelectTrigger aria-label={t("Specialist")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("Any")}</SelectItem>
                <SelectItem value="yes">{t("Has a specialist")}</SelectItem>
                <SelectItem value="no">{t("No specialist")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {specFilter === "yes" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("Specialist description")}</Label>
              <SearchableSelect
                value={noteFilter || undefined}
                ariaLabel={t("Specialist description")}
                noneLabel={t("All specialists")}
                options={notes.map((n) => ({ value: n, label: n }))}
                onChange={(v) => {
                  setNoteFilter(v ?? "");
                  setJobFilter("all");
                }}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("Job status")}</Label>
            <Select
              value={jobStatusFilter}
              onValueChange={(v) => {
                setJobStatusFilter(v as "any" | "Open" | "Closed");
                setJobFilter("all");
              }}
            >
              <SelectTrigger aria-label={t("Job status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("Any")}</SelectItem>
                <SelectItem value="Open">{t("Open")}</SelectItem>
                <SelectItem value="Closed">{t("Closed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">{t("Job")}</Label>
            <SearchableSelect
              value={jobFilter === "all" ? undefined : jobFilter}
              ariaLabel={t("Job")}
              noneLabel={t("All jobs")}
              options={jobOptions.map((j) => ({
                value: j.id,
                label: [jobTitle(j.title), j.specialist && j.specialistNote ? `(${j.specialistNote})` : "", j.location].filter(Boolean).join(" · "),
              }))}
              onChange={(v) => setJobFilter(v || "all")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("Applied from")}</Label>
            <Input type="date" dir="ltr" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("Applied until")}</Label>
            <Input type="date" dir="ltr" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          {(search || categoryFilter || titleFilter || specFilter !== "any" || jobStatusFilter !== "any" || jobFilter !== "all" || fromDate || toDate) && (
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter(null);
                  setTitleFilter("");
                  setSpecFilter("any");
                  setNoteFilter("");
                  setJobStatusFilter("any");
                  setJobFilter("all");
                  setFromDate("");
                  setToDate("");
                }}
              >
                {t("Clear filters")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!apps && !error && (
        <div className="flex gap-3 overflow-hidden">
          {boardStages.map((s) => (
            <Skeleton key={s} className="h-96 w-[280px] shrink-0 rounded-xl" />
          ))}
        </div>
      )}

      {apps && apps.length === 0 && totalApps === 0 && !error && !searchKey && jobFilter === "all" && !categoryFilter && (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title={t("No applications yet")}
          description={t("Add a candidate to a job to start moving them through the pipeline.")}
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="me-2 h-4 w-4" /> {t("Add Candidate to Job")}
            </Button>
          }
        />
      )}

      {apps && (apps.length > 0 || searchKey || jobFilter !== "all" || categoryFilter) && (
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragApp(null)}
        >
          <div className="-mx-4 overflow-x-auto px-4 pb-2 thin-scrollbar sm:mx-0 sm:px-0">
            <div className="flex items-start gap-3">
              {boardStages.map((stage) => (
                <KanbanColumn
                  key={stage}
                  stage={stage}
                  apps={filtered.filter((a) => a.stage === stage)}
                  total={counts[stage] ?? 0}
                  onLoadMore={() => loadMore(stage)}
                  onView={(app) => setDetailAppId(app.id)}
                  onSchedule={(app) => setScheduleFor(app)}
                  onMove={moveApplication}
                  onRemove={(app) => setDetailAppId(app.id)}
                />
              ))}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {dragApp ? (
              <ApplicationCard
                app={dragApp}
                overlay
                onView={() => {}}
                onSchedule={() => {}}
                onMove={() => {}}
                onRemove={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <AddApplicationDialog open={addOpen} onOpenChange={setAddOpen} onCreated={load} />

      <ApplicationDetailDialog
        key={detailAppId ?? "none"}
        app={detailApp}
        onClose={() => setDetailAppId(null)}
        onChanged={load}
        onScheduleInterview={(app) => setScheduleFor(app)}
        onNavigate={onNavigate}
      />

      <InterviewFormDialog
        open={!!scheduleFor}
        onOpenChange={(open) => !open && setScheduleFor(null)}
        presetApplicationId={scheduleFor?.id}
        onSaved={() => {
          load();
        }}
      />
    </div>
  );
}
