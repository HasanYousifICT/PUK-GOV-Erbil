"use client";

// Building blocks of the Applications page: the rich candidate card, the action menu, and the
// four layouts (Board is in applications-view.tsx; List, Cards and Steps are here).

import { useMemo, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarDays,
  Check,
  Clock,
  Columns3,
  Hash,
  LayoutGrid,
  Layers,
  List as ListIcon,
  ListOrdered,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JobTitleText } from "@/components/job-title-text";
import { Avatar, StageBadge, formatDate } from "@/components/shared";
import { categoryPathText, useCategories } from "@/components/category-picker";
import { categoryName, pathTo } from "@/lib/categories";
import { fmtDate, time12 } from "@/lib/datetime";
import { ALL_STAGES, REJECTED_STAGE, STAGES } from "@/lib/constants";
import type { Application } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { useCanInterview, useCanMove } from "@/lib/permissions-context";
import { cn } from "@/lib/utils";

/* -------------------------------- constants ------------------------------- */

export type ViewMode = "board" | "list" | "cards" | "steps";
export const VIEW_MODES: ViewMode[] = ["board", "list", "cards", "steps"];

export const STAGE_DOT: Record<string, string> = {
  Applied: "bg-slate-400",
  Screening: "bg-sky-400",
  Interview: "bg-blue-500",
  Selected: "bg-teal-500",
  Hired: "bg-emerald-500",
  Rejected: "bg-red-400",
};
export const STAGE_TOP: Record<string, string> = {
  Applied: "border-t-slate-300",
  Screening: "border-t-sky-400",
  Interview: "border-t-blue-500",
  Selected: "border-t-teal-500",
  Hired: "border-t-emerald-500",
  Rejected: "border-t-red-400",
};

export type AppActions = {
  onView: (app: Application) => void;
  onSchedule: (app: Application) => void;
  onMove: (app: Application, stage: string) => void;
  onRemove: (app: Application) => void;
};

/* --------------------------------- facts ---------------------------------- */

export type AppFacts = {
  name: string;
  code: string;
  phone: string;
  email: string;
  location: string;
  /** last level of the job's classification, and the full path for the tooltip */
  classification: string;
  classificationPath: string;
  nextInterview: { date: string; time: string } | null;
};

/** One function that returns everything shown about an application, in the current language. */
export function useAppFacts(): (app: Application) => AppFacts {
  const { locale } = useI18n();
  const { index } = useCategories();
  return useMemo(
    () => (app: Application) => {
      const catId = app.job?.categoryId;
      const path = catId && index ? pathTo(catId, index) : [];
      const next = (app.interviews ?? [])
        .filter((i) => i.status === "Scheduled")
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
      return {
        name: app.candidate?.name ?? "—",
        code: app.candidate?.code ?? "",
        phone: app.candidate?.phone ?? "",
        email: app.candidate?.email ?? "",
        location: app.candidate?.location ?? "",
        classification: path.length ? categoryName(path[path.length - 1], locale) : "",
        classificationPath: categoryPathText(catId, index, locale),
        nextInterview: next ? { date: next.date, time: next.time } : null,
      };
    },
    [index, locale]
  );
}

function Fact({ icon: Icon, children, title, ltr }: { icon: typeof Phone; children: ReactNode; title?: string; ltr?: boolean }) {
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" title={title}>
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="truncate" dir={ltr ? "ltr" : undefined}>
        {children}
      </span>
    </p>
  );
}

export function CodeChip({ code }: { code: string }) {
  if (!code) return null;
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground/80" dir="ltr">
      <Hash className="h-2.5 w-2.5 opacity-60" />
      {code}
    </span>
  );
}

/* ---------------------------------- menu ---------------------------------- */

export function ApplicationMenu({ app, actions }: { app: Application; actions: AppActions }) {
  const { t } = useI18n();
  const canMoveStage = useCanMove();
  const canScheduleIv = useCanInterview("schedule");
  return (
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
        <DropdownMenuItem onClick={() => actions.onView(app)}>{t("View details")}</DropdownMenuItem>
        {canScheduleIv && (
          <DropdownMenuItem onClick={() => actions.onSchedule(app)}>
            <CalendarDays className="me-2 h-4 w-4" /> {t("Schedule interview")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Clock className="me-2 h-4 w-4" /> {t("Move to stage")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 thin-scrollbar">
            {ALL_STAGES.map((s) => (
              <DropdownMenuItem key={s} disabled={s === app.stage || !canMoveStage(app.stage, s)} onClick={() => actions.onMove(app, s)}>
                {t(s)}
                {s === app.stage && <span className="ms-auto text-xs text-muted-foreground">{t("current")}</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => actions.onRemove(app)}>
          <Trash2 className="me-2 h-4 w-4" /> {t("Remove application")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------ board card -------------------------------- */

export function ApplicationCard({
  app,
  actions,
  dragging = false,
  overlay = false,
}: {
  app: Application;
  actions: AppActions;
  dragging?: boolean;
  overlay?: boolean;
}) {
  const { t } = useI18n();
  const facts = useAppFacts()(app);
  const count = app.interviews?.length ?? 0;
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm transition-shadow",
        overlay ? "w-72 rotate-1 shadow-lg" : "hover:shadow-md",
        dragging && "kanban-card-dragging"
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={facts.name} className="h-9 w-9 text-[11px]" />
        <div className="min-w-0 flex-1">
          <button className="block max-w-full truncate text-start text-sm font-semibold underline-offset-2 hover:underline" onClick={() => actions.onView(app)} title={facts.name}>
            {facts.name}
          </button>
          <div className="mt-0.5">
            <CodeChip code={facts.code} />
          </div>
        </div>
        {!overlay && <ApplicationMenu app={app} actions={actions} />}
      </div>

      <div className="mt-2.5 space-y-1 rounded-md bg-muted/40 px-2.5 py-2">
        <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium" title={app.job?.title}>
          <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{app.job ? <JobTitleText title={app.job.title} /> : "—"}</span>
        </p>
        {facts.classification && (
          <Fact icon={Layers} title={facts.classificationPath}>
            {facts.classification}
          </Fact>
        )}
      </div>

      <div className="mt-2 space-y-1">
        <Fact icon={MapPin}>{facts.location || "—"}</Fact>
        <Fact icon={Phone} ltr>
          {facts.phone || "—"}
        </Fact>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDate(app.appliedAt)}
        </span>
        {facts.nextInterview ? (
          <span className="flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700" title={t("Next interview")}>
            <CalendarDays className="h-3 w-3" />
            {fmtDate(facts.nextInterview.date)} · {time12(facts.nextInterview.time)}
          </span>
        ) : count > 0 ? (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {t(count === 1 ? "{n} interview" : "{n} interviews", { n: count })}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------ view switcher ----------------------------- */

const MODE_ICON = { board: Columns3, list: ListIcon, cards: LayoutGrid, steps: ListOrdered } as const;
const MODE_LABEL: Record<ViewMode, string> = { board: "Board", list: "List", cards: "Cards", steps: "Steps" };

export function ViewSwitcher({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const { t } = useI18n();
  return (
    <div role="group" aria-label={t("View as")} className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5">
      {VIEW_MODES.map((m) => {
        const Icon = MODE_ICON[m];
        const on = m === value;
        return (
          <button
            key={m}
            type="button"
            aria-pressed={on}
            title={t(MODE_LABEL[m])}
            onClick={() => onChange(m)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t(MODE_LABEL[m])}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------- stage tabs ------------------------------- */

/** "All" + one chip per stage with its total; used by the List and Cards layouts. */
export function StageTabs({
  value,
  onChange,
  counts,
}: {
  value: string;
  onChange: (stage: string) => void;
  counts: Record<string, number>;
}) {
  const { t } = useI18n();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const items: [string, string, number][] = [["all", t("All"), total], ...[...STAGES, REJECTED_STAGE].map((s): [string, string, number] => [s, t(s), counts[s] ?? 0])];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([key, label, n]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            value === key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          {key !== "all" && <span className={cn("h-1.5 w-1.5 rounded-full", value === key ? "bg-primary-foreground" : STAGE_DOT[key])} />}
          {label}
          <span className={cn("tabular-nums", value === key ? "opacity-90" : "opacity-70")}>{n}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------- list ---------------------------------- */

export function ApplicationsList({ apps, actions }: { apps: Application[]; actions: AppActions }) {
  const { t } = useI18n();
  const facts = useAppFacts();
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm thin-scrollbar">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="bg-muted/40 text-start text-xs text-muted-foreground">
            <th className="px-4 py-3 text-start font-medium">{t("Candidate")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("Job")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("Contact")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("Applied")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("Stage")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("Interviews")}</th>
            <th className="w-10 px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => {
            const f = facts(app);
            const n = app.interviews?.length ?? 0;
            return (
              <tr key={app.id} className="border-t align-middle hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={f.name} className="h-8 w-8 text-[10px]" />
                    <div className="min-w-0">
                      <button className="block max-w-[200px] truncate text-start font-medium underline-offset-2 hover:underline" onClick={() => actions.onView(app)} title={f.name}>
                        {f.name}
                      </button>
                      <CodeChip code={f.code} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <p className="max-w-[220px] truncate font-medium" title={app.job?.title}>
                    {app.job ? <JobTitleText title={app.job.title} /> : "—"}
                  </p>
                  {f.classification && (
                    <p className="max-w-[220px] truncate text-xs text-muted-foreground" title={f.classificationPath}>
                      {f.classification}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <p className="text-xs" dir="ltr">
                    {f.phone || "—"}
                  </p>
                  <p className="max-w-[160px] truncate text-xs text-muted-foreground">{f.location || "—"}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{formatDate(app.appliedAt)}</td>
                <td className="px-4 py-2.5">
                  <StageBadge stage={app.stage} />
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {f.nextInterview ? (
                    <span className="whitespace-nowrap font-medium text-blue-700">
                      {fmtDate(f.nextInterview.date)} · {time12(f.nextInterview.time)}
                    </span>
                  ) : n > 0 ? (
                    t(n === 1 ? "{n} interview" : "{n} interviews", { n })
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-2.5">
                  <ApplicationMenu app={app} actions={actions} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------- cards --------------------------------- */

function StageSelect({ app, onMove }: { app: Application; onMove: (stage: string) => void }) {
  const { t } = useI18n();
  const canMoveStage = useCanMove();
  return (
    <Select value={app.stage} onValueChange={onMove}>
      <SelectTrigger size="sm" className="h-8 w-full text-xs" aria-label={t("Move to stage")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ALL_STAGES.map((s) => (
          <SelectItem key={s} value={s} disabled={s === app.stage || !canMoveStage(app.stage, s)}>
            {t(s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ApplicationsCards({ apps, actions }: { apps: Application[]; actions: AppActions }) {
  const { t } = useI18n();
  const facts = useAppFacts();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {apps.map((app) => {
        const f = facts(app);
        const n = app.interviews?.length ?? 0;
        return (
          <div key={app.id} className={cn("flex flex-col rounded-xl border border-t-4 bg-card p-4 shadow-sm transition-shadow hover:shadow-md", STAGE_TOP[app.stage])}>
            <div className="flex items-start gap-3">
              <Avatar name={f.name} className="h-11 w-11 text-sm" />
              <div className="min-w-0 flex-1">
                <button className="block max-w-full truncate text-start text-base font-semibold underline-offset-2 hover:underline" onClick={() => actions.onView(app)} title={f.name}>
                  {f.name}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <CodeChip code={f.code} />
                  <StageBadge stage={app.stage} className="text-[10px]" />
                </div>
              </div>
              <ApplicationMenu app={app} actions={actions} />
            </div>

            <div className="mt-3 space-y-1.5 rounded-lg bg-muted/40 p-2.5">
              <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium" title={app.job?.title}>
                <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{app.job ? <JobTitleText title={app.job.title} /> : "—"}</span>
              </p>
              {f.classification && (
                <Fact icon={Layers} title={f.classificationPath}>
                  {f.classification}
                </Fact>
              )}
            </div>

            <div className="mt-3 grid gap-1.5">
              <Fact icon={MapPin}>{f.location || "—"}</Fact>
              <Fact icon={Phone} ltr>
                {f.phone || "—"}
              </Fact>
              {f.email && (
                <Fact icon={Mail} ltr>
                  {f.email}
                </Fact>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDate(app.appliedAt)}
              </span>
              {f.nextInterview ? (
                <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {fmtDate(f.nextInterview.date)} · {time12(f.nextInterview.time)}
                </span>
              ) : n > 0 ? (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t(n === 1 ? "{n} interview" : "{n} interviews", { n })}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <StageSelect app={app} onMove={(s) => actions.onMove(app, s)} />
              </div>
              <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => actions.onView(app)}>
                {t("View details")}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------- steps --------------------------------- */

export function StepsBar({
  step,
  onChange,
  counts,
}: {
  step: string;
  onChange: (stage: string) => void;
  counts: Record<string, number>;
}) {
  const { t } = useI18n();
  const idx = (STAGES as readonly string[]).indexOf(step);
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-0 overflow-x-auto pb-1 thin-scrollbar">
        {STAGES.map((s, i) => {
          const on = s === step;
          const done = idx > i;
          return (
            <div key={s} className="flex min-w-[110px] flex-1 items-start">
              <button type="button" onClick={() => onChange(s)} aria-current={on ? "step" : undefined} className="group flex w-full flex-col items-center gap-1.5 px-1 text-center">
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : done ? "border-primary/60 bg-primary/10 text-primary" : "bg-card text-muted-foreground group-hover:border-primary/40"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={cn("text-xs font-medium", on ? "text-foreground" : "text-muted-foreground")}>{t(s)}</span>
                <span className={cn("rounded-full px-2 py-px text-[11px] font-semibold tabular-nums", on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{counts[s] ?? 0}</span>
              </button>
              {i < STAGES.length - 1 && <span className={cn("mt-[18px] h-0.5 w-6 shrink-0 rounded sm:w-10", done ? "bg-primary/60" : "bg-border")} />}
            </div>
          );
        })}
        <div className="ms-3 flex min-w-[96px] items-start border-s ps-3">
          <button type="button" onClick={() => onChange(REJECTED_STAGE)} aria-current={step === REJECTED_STAGE ? "step" : undefined} className="group flex w-full flex-col items-center gap-1.5 px-1 text-center">
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors", step === REJECTED_STAGE ? "border-red-500 bg-red-500 text-white" : "bg-card text-red-500 group-hover:border-red-300")}>
              <XCircle className="h-4 w-4" />
            </span>
            <span className={cn("text-xs font-medium", step === REJECTED_STAGE ? "text-foreground" : "text-muted-foreground")}>{t(REJECTED_STAGE)}</span>
            <span className={cn("rounded-full px-2 py-px text-[11px] font-semibold tabular-nums", step === REJECTED_STAGE ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground")}>{counts[REJECTED_STAGE] ?? 0}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** The candidates of one step, each with the buttons to take them to the next step, back, or reject. */
export function StepList({ step, apps, actions }: { step: string; apps: Application[]; actions: AppActions }) {
  const { t } = useI18n();
  const facts = useAppFacts();
  const canMoveStage = useCanMove();
  const i = (STAGES as readonly string[]).indexOf(step);
  const next = i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
  const prev = i > 0 ? STAGES[i - 1] : step === REJECTED_STAGE ? STAGES[0] : null;
  return (
    <div className="space-y-2">
      {apps.map((app) => {
        const f = facts(app);
        return (
          <div key={app.id} className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-3 lg:w-[30%]">
              <Avatar name={f.name} className="h-10 w-10 text-xs" />
              <div className="min-w-0">
                <button className="block max-w-full truncate text-start text-sm font-semibold underline-offset-2 hover:underline" onClick={() => actions.onView(app)} title={f.name}>
                  {f.name}
                </button>
                <CodeChip code={f.code} />
              </div>
            </div>
            <div className="min-w-0 space-y-1 lg:w-[30%]">
              <p className="flex items-center gap-1.5 text-sm font-medium" title={app.job?.title}>
                <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{app.job ? <JobTitleText title={app.job.title} /> : "—"}</span>
              </p>
              {f.classification && (
                <Fact icon={Layers} title={f.classificationPath}>
                  {f.classification}
                </Fact>
              )}
            </div>
            <div className="min-w-0 space-y-1 lg:w-[20%]">
              <Fact icon={Phone} ltr>
                {f.phone || "—"}
              </Fact>
              <Fact icon={MapPin}>{f.location || "—"}</Fact>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:ms-auto lg:justify-end">
              {prev && (
                <Button variant="ghost" size="sm" disabled={!canMoveStage(app.stage, prev)} onClick={() => actions.onMove(app, prev)}>
                  <ArrowLeft className="me-1.5 h-3.5 w-3.5 rtl:rotate-180" />
                  {t(prev)}
                </Button>
              )}
              {step !== REJECTED_STAGE && (
                <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-600" disabled={!canMoveStage(app.stage, REJECTED_STAGE)} onClick={() => actions.onMove(app, REJECTED_STAGE)}>
                  <XCircle className="me-1.5 h-3.5 w-3.5" />
                  {t("Reject")}
                </Button>
              )}
              {next && (
                <Button size="sm" disabled={!canMoveStage(app.stage, next)} onClick={() => actions.onMove(app, next)}>
                  {t(next)}
                  <ArrowRight className="ms-1.5 h-3.5 w-3.5 rtl:rotate-180" />
                </Button>
              )}
              <ApplicationMenu app={app} actions={actions} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
