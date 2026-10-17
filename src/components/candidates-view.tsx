"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  CalendarDays,
  Clock,
  Download,
  FileText,
  Filter,
  X,
  GraduationCap,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "@/lib/notify";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ALL_STAGES,
} from "@/lib/constants";
import {
  apiClient,
  Candidate,
  CandidateDetail,
  Interview,
} from "@/lib/client";
import { NavState } from "@/components/app-shell";
import { CandidateFormDialog } from "@/components/candidate-form-dialog";
import { CandidateFilterPanel } from "@/components/candidate-filter-panel";
import { BulkAddToJobDialog } from "@/components/bulk-add-dialog";
import { CustomFieldValue, useCandidateFields } from "@/components/candidate-fields";
import { activeFilterCount, CandidateFilters } from "@/lib/candidate-filters";
import { fieldLabel, parseCustomData } from "@/lib/candidate-fields";
import { Job } from "@/lib/client";
import { AddApplicationDialog } from "@/components/add-application-dialog";
import {
  Avatar,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  formatDate,
  InterviewStatusBadge,
  PageHeader,
  splitList,
  StageBadge,
  TableSkeleton,
  TagBadge,
  useLoadEffect,
} from "@/components/shared";

import { useI18n } from "@/lib/i18n";
/* ------------------------------- Candidates list ------------------------------ */

export function CandidatesView({ onNavigate }: { onNavigate: (state: NavState) => void }) {
  const { t } = useI18n();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [deleting, setDeleting] = useState<Candidate | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [filters, setFilters] = useState<CandidateFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const filterCount = activeFilterCount(filters);
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    apiClient.listJobs().then(setJobs).catch(() => setJobs([]));
  }, []);

  const load = useCallback(async () => {
    try {
      const f = JSON.parse(filtersKey) as CandidateFilters;
      const rows = await apiClient.listCandidates(query.trim() || undefined, filterCount > 0 ? f : undefined);
      setCandidates(rows);
      // keep only selected candidates that are still visible
      setSelected((prev) => {
        const visible = new Set(rows.map((r) => r.id));
        const next = new Set([...prev].filter((id) => visible.has(id)));
        return next.size === prev.size ? prev : next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load candidates");
    }
  }, [query, filtersKey, filterCount]);

  useEffect(() => {
    const t = setTimeout(load, query || filterCount ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, query, filterCount]);

  const allSelected = !!candidates?.length && selected.size === candidates.length;
  const someSelected = selected.size > 0 && !allSelected;
  const toggleAll = () =>
    setSelected(allSelected || !candidates ? new Set() : new Set(candidates.map((c) => c.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiClient.deleteCandidate(deleting.id);
      toast.success("Candidate deleted");
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete candidate");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Candidates")}
        description={t("Your talent database — add candidates manually or by uploading resumes.")}
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="me-2 h-4 w-4" />
            {t("Add Candidate")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("Search by name, email, skill, tag…")}
            className="ps-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("Search candidates")}
          />
        </div>
        <Button variant={showFilters ? "secondary" : "outline"} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
          <Filter className="me-2 h-4 w-4" />
          {t("Filters")}
          {filterCount > 0 && (
            <Badge className="ms-2 h-5 min-w-5 justify-center px-1.5">{filterCount}</Badge>
          )}
        </Button>
        {(filterCount > 0 || query) && (
          <Button
            variant="ghost"
            onClick={() => {
              setFilters({});
              setQuery("");
            }}
          >
            <X className="me-1.5 h-4 w-4" />
            {t("Clear all")}
          </Button>
        )}
      </div>

      {showFilters && <CandidateFilterPanel filters={filters} onChange={setFilters} jobs={jobs} />}

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 shadow-sm">
          <span className="text-sm font-medium">{t("{n} selected", { n: selected.size })}</span>
          <Button size="sm" onClick={() => setBulkOpen(true)}>
            <Briefcase className="me-1.5 h-4 w-4" />
            {t("Add to job")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {t("Clear selection")}
          </Button>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {!candidates && !error && <TableSkeleton rows={5} />}

      {candidates && candidates.length === 0 && !error && (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={query ? "No candidates match your search" : "No candidates yet"}
          description={
            query
              ? "Try a different name, skill or tag."
              : "Add your first candidate — upload a resume and we'll pre-fill the profile."
          }
          action={
            query || filterCount > 0 ? (
              <Button variant="outline" onClick={() => { setQuery(""); setFilters({}); }}>
                {t("Clear search")}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="me-2 h-4 w-4" />
                {t("Add candidate")}
              </Button>
            )
          }
        />
      )}

      {candidates && candidates.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-start text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="w-10 ps-4 py-3">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                      aria-label={t("Select all")}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">{t("Candidate")}</th>
                  <th className="px-4 py-3 font-medium">{t("Skills")}</th>
                  <th className="px-4 py-3 font-medium">{t("Experience")}</th>
                  <th className="px-4 py-3 font-medium">{t("Location")}</th>
                  <th className="px-4 py-3 text-center font-medium">{t("Applications")}</th>
                  <th className="px-4 py-3 text-end font-medium">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/30"
                    onClick={() => onNavigate({ view: "candidate-detail", candidateId: c.id })}
                  >
                    <td className="w-10 ps-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={() => toggleOne(c.id)}
                        aria-label={t("Select {name}", { name: c.name })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} />
                        <div className="min-w-0">
                          <p className="font-medium">{c.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{c.email || t("No email")}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-52 px-4 py-3">
                      <p className="truncate text-muted-foreground">{c.skills || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.experience || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.location || "—"}</td>
                    <td className="px-4 py-3 text-center font-medium tabular-nums">
                      {c._count?.applications ?? 0}
                    </td>
                    <td className="px-4 py-3 text-end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={t("Actions for {name}", { name: c.name })}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => onNavigate({ view: "candidate-detail", candidateId: c.id })}>
                            {t("View profile")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(c);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="me-2 h-4 w-4" /> {t("Edit")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleting(c)}>
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
            {candidates.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                className="rounded-xl border bg-card p-4 shadow-sm"
                onClick={() => onNavigate({ view: "candidate-detail", candidateId: c.id })}
                onKeyDown={(e) => e.key === "Enter" && onNavigate({ view: "candidate-detail", candidateId: c.id })}
              >
                <div className="flex items-center gap-3">
                  <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggleOne(c.id)}
                      aria-label={t("Select {name}", { name: c.name })}
                    />
                  </span>
                  <Avatar name={c.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.email || t("No email")}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{c.experience || ""}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{c.skills || t("No skills listed")}</span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    {t("{n} applications", { n: c._count?.applications ?? 0 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <CandidateFormDialog open={formOpen} onOpenChange={setFormOpen} candidate={editing} onSaved={load} />
      <BulkAddToJobDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        candidateIds={[...selected]}
        jobs={jobs}
        onDone={() => {
          load();
          apiClient.listJobs().then(setJobs).catch(() => {});
        }}
        onOpenBoard={() => onNavigate({ view: "applications" })}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("Delete “{name}”?", { name: deleting?.name ?? "" })}
        description={t("This permanently deletes the candidate, their applications, interviews and stored resume.")}
        onConfirm={handleDelete}
        busy={deleteBusy}
      />
    </div>
  );
}

/* ------------------------------ Candidate detail ------------------------------ */

export function CandidateDetailView({
  candidateId,
  onNavigate,
}: {
  candidateId: string;
  onNavigate: (state: NavState) => void;
}) {
  const { t } = useI18n();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCandidate(await apiClient.getCandidate(candidateId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load candidate");
    }
  }, [candidateId]);

  useLoadEffect(load);

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      await apiClient.deleteCandidate(candidateId);
      toast.success("Candidate deleted");
      onNavigate({ view: "candidates" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete candidate");
      setDeleteBusy(false);
    }
  }

  async function moveStage(applicationId: string, stage: string) {
    try {
      await apiClient.moveApplication(applicationId, stage);
      toast.success(t("Moved to {stage}", { stage: t(stage) }));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not move candidate");
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => onNavigate({ view: "candidates" })}>
          <ArrowLeft className="rtl:-scale-x-100 me-2 h-4 w-4" /> {t("Back to Candidates")}
        </Button>
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-36 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    );
  }

  const interviews: Interview[] = candidate.applications.flatMap((a) => a.interviews ?? []);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => onNavigate({ view: "candidates" })}>
        <ArrowLeft className="rtl:-scale-x-100 me-2 h-4 w-4" /> {t("Back to Candidates")}
      </Button>

      {/* Profile header */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={candidate.name} className="h-14 w-14 rounded-2xl text-lg" />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{candidate.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {candidate.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {candidate.email}
                  </span>
                )}
                {candidate.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {candidate.phone}
                  </span>
                )}
                {candidate.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {candidate.location}
                  </span>
                )}
              </div>
              {splitList(candidate.tags).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {splitList(candidate.tags).map((tag) => (
                    <TagBadge key={tag} tag={tag} />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap shrink-0 gap-2">
            <Button onClick={() => setAddJobOpen(true)}>
              <Plus className="me-2 h-4 w-4" /> {t("Add to Job")}
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="me-2 h-4 w-4" /> {t("Edit")}
            </Button>
            <Button
              variant="outline"
              className="text-red-600 hover:bg-red-50 hover:text-red-600"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="me-2 h-4 w-4" /> {t("Delete")}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: profile info */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("Profile")}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5" /> {t("Experience")}
                </dt>
                <dd className="text-end font-medium">{candidate.experience || "—"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Banknote className="h-3.5 w-3.5" /> {t("Salary")}
                </dt>
                <dd className="text-end font-medium">{candidate.salary || "—"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {t("Notice Period")}
                </dt>
                <dd className="text-end font-medium">{candidate.noticePeriod || "—"}</dd>
              </div>
            </dl>
            <Separator className="my-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("Skills")}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {splitList(candidate.skills).length ? (
                splitList(candidate.skills).map((s) => (
                  <Badge key={s} variant="secondary" className="font-normal">
                    {s}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{t("No skills listed")}</span>
              )}
            </div>
            <Separator className="my-4" />
            <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <GraduationCap className="h-4 w-4" /> {t("Education")}
            </h3>
            <p className="mt-1.5 text-sm">{candidate.education || t("No education details")}</p>
          </div>

          {/* Additional information */}
          <CustomFieldsCard customData={candidate.customData} />

          {/* Resume */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("Resume")}</h2>
            {candidate.resume ? (
              <div className="mt-3 flex items-center gap-3 rounded-lg border px-3 py-2.5">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{candidate.resumeName || "Resume"}</p>
                  <p className="text-xs text-muted-foreground">{t("Uploaded file")}</p>
                </div>
                <a
                  href={apiClient.resumeUrl(candidate.resume)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-accent"
                >
                  <Download className="h-3.5 w-3.5" /> {t("View")}
                </a>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("No resume uploaded.")}{" "}
                <button className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => setEditOpen(true)}>
                  {t("Upload one now")}
                </button>
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("Notes")}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {candidate.notes || t("No notes yet.")}
            </p>
          </div>
        </div>

        {/* Right: applications + interviews */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("Applications ({n})", { n: candidate.applications.length })}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setAddJobOpen(true)}>
                <Plus className="me-1 h-3.5 w-3.5" /> {t("Add to job")}
              </Button>
            </div>

            {candidate.applications.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("Not applied to any job yet.")}
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {candidate.applications.map((app) => (
                  <div key={app.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        className="text-start text-sm font-medium underline-offset-2 hover:underline"
                        onClick={() => onNavigate({ view: "job-detail", jobId: app.job.id })}
                      >
                        {app.job.title}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {t("Applied")} {formatDate(app.appliedAt)}
                        </span>
                        <StageBadge stage={app.stage} />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {app.job.location || "—"} · {t(app.job.employmentType)}
                      </p>
                      <Select value={app.stage} onValueChange={(s) => moveStage(app.id, s)}>
                        <SelectTrigger className="h-7 w-36 text-xs" aria-label={`Move ${candidate.name} to stage`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_STAGES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {t("Move to {stage}", { stage: t(s) })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("Interviews ({n})", { n: interviews.length })}
            </h2>
            {interviews.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("No interviews scheduled yet.")}
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {interviews.map((iv) => (
                  <div key={iv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {iv.interviewer} · {iv.application?.job?.title}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {t("{date} at {time}", { date: formatDate(iv.date), time: iv.time })}
                      </p>
                    </div>
                    <InterviewStatusBadge status={iv.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CandidateFormDialog open={editOpen} onOpenChange={setEditOpen} candidate={candidate} onSaved={load} />
      <AddApplicationDialog
        open={addJobOpen}
        onOpenChange={setAddJobOpen}
        defaultCandidateId={candidate.id}
        onCreated={load}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("Delete “{name}”?", { name: candidate.name })}
        description={t("This permanently deletes the candidate, their applications, interviews and stored resume.")}
        onConfirm={handleDelete}
        busy={deleteBusy}
      />
    </div>
  );
}

function CustomFieldsCard({ customData }: { customData: string }) {
  const { t, locale } = useI18n();
  const { fields } = useCandidateFields();
  const data = useMemo(() => parseCustomData(customData), [customData]);
  if (!fields || fields.length === 0) return null;
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("Additional information")}
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.id} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{fieldLabel(f, locale)}</dt>
            <dd className="mt-0.5 text-sm">
              <CustomFieldValue field={f} value={data[f.id]} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
