"use client";

import { ReactNode, useCallback, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  ClipboardList,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityStageIcon, Avatar, ErrorState, formatDate, formatDateTime, PageHeader, useLoadEffect } from "@/components/shared";
import { apiClient, DashboardData, SessionUser } from "@/lib/client";
import { NavState } from "@/components/app-shell";
import { STAGES, STAGE_STYLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

/** A white card with a title row — the building block of the dashboard. */
function Panel({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Change versus the previous 7 days. */
function Delta({ now, before }: { now: number; before: number }) {
  const { t } = useI18n();
  if (now === 0 && before === 0) return <span className="text-xs text-muted-foreground">{t("No change")}</span>;
  const diff = now - before;
  const up = diff >= 0;
  const pct = before === 0 ? null : Math.round((Math.abs(diff) / before) * 100);
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", up ? "text-emerald-600" : "text-red-600")}>
      <Icon className="h-3.5 w-3.5" />
      {pct === null ? `+${diff}` : `${up ? "+" : "−"}${pct}%`}
      <span className="ms-1 font-normal text-muted-foreground">{t("vs last 7 days")}</span>
    </span>
  );
}

export function DashboardView({ user, onNavigate }: { user: SessionUser; onNavigate: (state: NavState) => void }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiClient.dashboard());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    }
  }, []);

  useLoadEffect(load);

  const stats = data?.stats;
  const today = new Date().toLocaleDateString(locale === "ckb" ? "ckb-IQ" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // reached each stage or later (a funnel); rejected applications only count as having applied
  const totalApps: number = data ? [...STAGES, "Rejected"].reduce((sum: number, k: string) => sum + (data.pipeline[k] ?? 0), 0) : 0;
  const funnel = data
    ? STAGES.map((stage, i) => ({
        stage,
        count: STAGES.slice(i).reduce((sum, s) => sum + (data.pipeline[s] ?? 0), 0) + (i === 0 ? data.pipeline["Rejected"] ?? 0 : 0),
      }))
    : [];
  const hireRate = stats && stats.totalApplications > 0 ? Math.round((stats.hires / stats.totalApplications) * 100) : 0;

  const kpis = stats && data
    ? [
        {
          label: "Open Jobs",
          value: stats.openJobs,
          foot: <span className="text-xs text-muted-foreground">{t("{n} total jobs", { n: stats.totalJobs })}</span>,
          icon: Briefcase,
          tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
          view: "jobs" as const,
        },
        {
          label: "Candidates",
          value: stats.totalCandidates,
          foot: <Delta now={data.trends.candidates7d} before={data.trends.candidatesPrev7d} />,
          icon: Users,
          tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
          view: "candidates" as const,
        },
        {
          label: "Applications",
          value: stats.totalApplications,
          foot: <Delta now={data.trends.applications7d} before={data.trends.applicationsPrev7d} />,
          icon: ClipboardList,
          tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
          view: "applications" as const,
        },
        {
          label: "Interviews",
          value: stats.upcomingInterviews,
          foot: <span className="text-xs text-muted-foreground">{t("scheduled / upcoming")}</span>,
          icon: CalendarDays,
          tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
          view: "interviews" as const,
        },
        {
          label: "Hires",
          value: stats.hires,
          foot: <span className="text-xs text-muted-foreground">{t("{n}% hire rate", { n: hireRate })}</span>,
          icon: UserCheck,
          tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
          view: "applications" as const,
        },
      ]
    : [];

  const maxJob = data ? Math.max(1, ...data.topJobs.map((j) => j.applications)) : 1;
  const portal = data?.portal;
  const portalPct = portal && portal.total > 0 ? Math.round((portal.submitted / portal.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Welcome back, {name}", { name: user.name.split(" ")[0] })}
        description={today}
        action={
          <>
            <Button variant="outline" onClick={() => onNavigate({ view: "jobs" })}>
              <Briefcase className="me-2 h-4 w-4" /> {t("Jobs")}
            </Button>
            <Button onClick={() => onNavigate({ view: "candidates" })}>
              <UserPlus className="me-2 h-4 w-4" /> {t("Candidates")}
            </Button>
          </>
        }
      />

      {error && <ErrorState message={error} onRetry={load} />}

      {!data && !error && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-5">
            <Skeleton className="h-80 rounded-xl lg:col-span-3" />
            <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          </div>
        </div>
      )}

      {data && stats && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
            {kpis.map(({ label, value, foot, icon: Icon, tone, view }) => (
              <button
                key={label}
                onClick={() => onNavigate({ view } as NavState)}
                className="group rounded-xl border bg-card p-4 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{t(label)}</span>
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone)}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
                <div className="mt-1 truncate">{foot}</div>
              </button>
            ))}
          </div>

          {/* Trend + funnel */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Panel
              className="lg:col-span-3"
              title={t("Applications over time")}
              subtitle={t("New applications per day, last 30 days")}
            >
              <div className="h-64 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trends.applicationsByDay} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="appsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      interval={4}
                      tickFormatter={(d: string) => d.slice(5)}
                    />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                    <Tooltip
                      cursor={{ stroke: "var(--border)" }}
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                            <p className="font-medium">{formatDate(String(payload[0].payload.date))}</p>
                            <p className="text-muted-foreground">
                              {t("{n} applications", { n: Number(payload[0].value) })}
                            </p>
                          </div>
                        ) : null
                      }
                    />
                    <Area type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} fill="url(#appsFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel
              className="lg:col-span-2"
              title={t("Recruitment Pipeline")}
              subtitle={t("Applications that reached each stage")}
              action={
                <Button variant="ghost" size="sm" onClick={() => onNavigate({ view: "applications" })}>
                  {t("Open board")}
                  <ArrowRight className="ms-1 h-3.5 w-3.5 rtl:-scale-x-100" />
                </Button>
              }
            >
              <ul className="space-y-3.5">
                {funnel.map(({ stage, count }) => {
                  const pct = totalApps > 0 ? Math.round((count / totalApps) * 100) : 0;
                  return (
                    <li key={stage}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          <span className={cn("h-2.5 w-2.5 rounded-full border", STAGE_STYLES[stage])} />
                          {t(stage)}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {count} <span className="text-xs">· {pct}%</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%`, opacity: 0.35 + 0.65 * (pct / 100) }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                {t("{n} rejected", { n: stats.rejected })}
              </p>
            </Panel>
          </div>

          {/* Interviews, jobs, portal */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              title={t("Upcoming interviews")}
              action={
                <Button variant="ghost" size="sm" onClick={() => onNavigate({ view: "interviews" })}>
                  {t("View all")}
                </Button>
              }
            >
              {data.upcoming.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t("No upcoming interviews.")}</p>
              ) : (
                <ul className="space-y-3">
                  {data.upcoming.map((i) => (
                    <li key={i.id}>
                      <button
                        className="flex w-full items-center gap-3 rounded-lg p-1.5 text-start transition-colors hover:bg-muted/60"
                        onClick={() => onNavigate({ view: "candidate-detail", candidateId: i.candidateId })}
                      >
                        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <span className="text-sm font-bold leading-none tabular-nums">{i.date.slice(8, 10)}</span>
                          <span className="mt-0.5 text-[9px] uppercase leading-none">
                            {new Date(`${i.date}T00:00:00`).toLocaleDateString(locale === "ckb" ? "ckb-IQ" : "en-GB", { month: "short" })}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{i.candidate}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {i.time} · {i.job}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title={t("Top open jobs")}
              action={
                <Button variant="ghost" size="sm" onClick={() => onNavigate({ view: "jobs" })}>
                  {t("View all")}
                </Button>
              }
            >
              {data.topJobs.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t("No open jobs yet.")}</p>
              ) : (
                <ul className="space-y-3.5">
                  {data.topJobs.map((j) => (
                    <li key={j.id}>
                      <button className="w-full text-start" onClick={() => onNavigate({ view: "job-detail", jobId: j.id })}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-medium">{j.title}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{j.applications}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((j.applications / maxJob) * 100)}%` }} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title={t("Candidate portal")}
              subtitle={t("Candidates invited to apply with their own login")}
              action={
                user.role === "admin" ? (
                  <Button variant="ghost" size="sm" onClick={() => onNavigate({ view: "settings", tab: "access" })}>
                    {t("Manage")}
                  </Button>
                ) : undefined
              }
            >
              {portal && portal.total > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold tabular-nums">{portal.submitted}</p>
                      <p className="text-xs text-muted-foreground">{t("of {n} have submitted", { n: portal.total })}</p>
                    </div>
                    <span className="text-sm font-semibold text-primary">{portalPct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${portalPct}%` }} />
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UsersRound className="h-3.5 w-3.5" />
                    {t("{n} waiting to apply", { n: portal.total - portal.submitted })}
                  </p>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">{t("No candidate logins created yet.")}</p>
              )}
            </Panel>
          </div>

          {/* Recent activity */}
          <Panel title={t("Recent Activity")}>
            {data.recentActivity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("No pipeline activity yet.")}</p>
            ) : (
              <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                {data.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <Avatar name={a.candidate} className="h-8 w-8 text-xs" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate">
                        <span className="font-medium">{a.candidate}</span>{" "}
                        <span className="text-muted-foreground">
                          {a.previousStage
                            ? t("moved from {from} to {to}", { from: t(a.previousStage), to: t(a.newStage) })
                            : t("applied")}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.job} · {formatDateTime(a.changedAt)}
                      </p>
                    </div>
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <ActivityStageIcon newStage={a.newStage} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
