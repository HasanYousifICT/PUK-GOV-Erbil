"use client";

// The static list of job titles: a picker (with "add a new title") used by the job form,
// and the management page under Settings.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { ApiClientError, JobTitle, apiClient } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { useCan } from "@/lib/permissions-context";
import { CategoryPicker, categoryPathText, useCategories } from "@/components/category-picker";
import { SearchableSelect } from "@/components/searchable-select";
import { ConfirmDialog, EmptyState, ErrorState, Spinner } from "@/components/shared";

export function useJobTitles() {
  const [list, setList] = useState<JobTitle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setList(await apiClient.listJobTitles());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load job titles");
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { list, error, reload, setList };
}

const titleLabel = (r: JobTitle, locale: "en" | "ckb") => (locale === "ckb" && r.titleCkb ? r.titleCkb : r.title);

/**
 * Pick a job title from the static list. A title that is not in the list can be added on the spot.
 * `onChange` also gives the title's default classification (if it has one).
 */
export function JobTitlePicker({
  value,
  onChange,
  categoryId,
  open,
}: {
  value: string;
  onChange: (title: string, defaultCategoryId: string | null) => void;
  /** Classification currently chosen in the form — saved with a newly added title. */
  categoryId: string | null;
  /** Re-load the list every time the surrounding dialog opens. */
  open?: boolean;
}) {
  const { t, locale } = useI18n();
  const canEdit = useCan("jobs", "edit");
  const { list, reload, setList } = useJobTitles();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      reload();
      setAdding(false);
      setNewTitle("");
      setError(null);
    }
  }, [open, reload]);

  const options = useMemo(() => {
    const rows = (list ?? []).map((r) => ({ value: r.title, label: titleLabel(r, locale) }));
    // a title the job already has that is not in the list (older jobs) stays selectable
    if (value && !rows.some((o) => o.value === value)) rows.unshift({ value, label: value });
    return rows;
  }, [list, locale, value]);

  async function add() {
    const title = newTitle.replace(/\s+/g, " ").trim();
    if (!title) return;
    if (!categoryId) {
      setError("Please choose a job classification");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const row = await apiClient.createJobTitle({ title, categoryId });
      setList((l) => [...(l ?? []), row]);
      toast.success(t("Job title added to the list"));
      onChange(row.title, row.categoryId);
      setAdding(false);
      setNewTitle("");
    } catch (e) {
      if (e instanceof ApiClientError && e.data?.id) {
        // already in the list: just use it
        await reload();
        const existing = (list ?? []).find((r) => r.title.toLowerCase() === title.toLowerCase());
        onChange(existing?.title ?? title, existing?.categoryId ?? null);
        setAdding(false);
        setNewTitle("");
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <SearchableSelect
        value={value || undefined}
        onChange={(v) => {
          const row = (list ?? []).find((r) => r.title === v);
          onChange(v ?? "", row?.categoryId ?? null);
        }}
        options={options}
        placeholder={t("Select a job title")}
        ariaLabel={t("Job title")}
      />
      {canEdit &&
        (adding ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <Label htmlFor="new-job-title" className="text-xs">
              {t("New job title (added to the list)")}
            </Label>
            <div className="flex gap-2">
              <Input
                id="new-job-title"
                autoFocus
                value={newTitle}
                placeholder={t("e.g. Senior Frontend Developer")}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
              />
              <Button type="button" onClick={add} disabled={busy || !newTitle.trim()}>
                {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("Add")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)} disabled={busy}>
                {t("Cancel")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("Choose the job classification below first — it is saved with this title.")}
            </p>
            {error && <p className="text-xs text-red-600">{t(error)}</p>}
          </div>
        ) : (
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setAdding(true)}>
            <Plus className="me-1 h-3.5 w-3.5" />
            {t("Not in the list? Add a new job title")}
          </Button>
        ))}
    </div>
  );
}

/* ------------------------------ Settings page ------------------------------ */

export function JobTitlesSettings() {
  const { t, locale } = useI18n();
  const canEdit = useCan("jobs", "edit");
  const { list, error, reload } = useJobTitles();
  const { index } = useCategories();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<JobTitle | "new" | null>(null);
  const [deleting, setDeleting] = useState<JobTitle | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list ?? []).filter(
      (r) => !s || r.title.toLowerCase().includes(s) || r.titleCkb.toLowerCase().includes(s)
    );
  }, [list, q]);

  async function remove() {
    if (!deleting) return;
    setDelBusy(true);
    try {
      await apiClient.deleteJobTitle(deleting.id);
      toast.success(t("Job title removed from the list"));
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setDelBusy(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!list) return <Spinner />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("The list of job titles. When you create a job you pick a title from this list (and can add a new one). Each title can have a default classification.")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search job titles…")} className="ps-9" />
        </div>
        <span className="text-sm text-muted-foreground">{t("{n} titles", { n: rows.length })}</span>
        {canEdit && (
          <Button className="ms-auto" onClick={() => setEditing("new")}>
            <Plus className="me-2 h-4 w-4" />
            {t("Add job title")}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No job titles yet" description="Add the first job title to start the list." />
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium" dir="auto">
                  {r.title}
                  {r.titleCkb && <span className="ms-2 text-sm font-normal text-muted-foreground" dir="rtl">{r.titleCkb}</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.categoryId ? categoryPathText(r.categoryId, index, locale) : t("No classification")}
                  {" · "}
                  {t("{n} jobs", { n: r.jobCount ?? 0 })}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label={t("Edit")} onClick={() => setEditing(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={t("Delete")} onClick={() => setDeleting(r)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <TitleDialog
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("Delete “{name}”?", { name: deleting?.title ?? "" })}
        description={t("It is removed from the list only. Jobs that already use this title keep it.")}
        onConfirm={remove}
        busy={delBusy}
      />
    </div>
  );
}

function TitleDialog({
  row,
  onClose,
  onSaved,
}: {
  row: JobTitle | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { index } = useCategories();
  const [title, setTitle] = useState("");
  const [titleCkb, setTitleCkb] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (row) {
      setError(null);
      setTitle(row === "new" ? "" : row.title);
      setTitleCkb(row === "new" ? "" : row.titleCkb);
      setCategoryId(row === "new" ? null : row.categoryId);
    }
  }, [row]);

  async function save() {
    if (!title.trim()) {
      setError("Job title is required");
      return;
    }
    if (!categoryId) {
      setError("Please choose a job classification");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (row === "new") await apiClient.createJobTitle({ title, titleCkb, categoryId });
      else if (row) await apiClient.updateJobTitle(row.id, { title, titleCkb, categoryId });
      toast.success(t("Saved"));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg thin-scrollbar">
        <DialogHeader>
          <DialogTitle>{row === "new" ? t("Add job title") : t("Edit job title")}</DialogTitle>
          <DialogDescription>{t("Job titles are picked from this list when a job is created.")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jt-title">{t("Job Title *")}</Label>
            <Input id="jt-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jt-ckb">{t("Kurdish name (optional)")}</Label>
            <Input id="jt-ckb" dir="rtl" value={titleCkb} onChange={(e) => setTitleCkb(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("Job Classification *")}</Label>
            <CategoryPicker value={categoryId} onChange={setCategoryId} index={index} />
          </div>
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(error)}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
