"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog, ErrorState, PageHeader, TableSkeleton } from "@/components/shared";
import { categoryPathText, useCategories } from "@/components/category-picker";
import { apiClient } from "@/lib/client";
import { categoryName, JobCategory, MAX_CATEGORY_DEPTH, CategoryIndex } from "@/lib/categories";
import { useI18n } from "@/lib/i18n";

type Editing = { mode: "add"; parent: JobCategory | null } | { mode: "edit"; category: JobCategory };

function CategoryFormDialog({
  editing,
  onClose,
  onSaved,
  index,
}: {
  editing: Editing | null;
  onClose: () => void;
  onSaved: () => void;
  index: CategoryIndex;
}) {
  const { t, locale } = useI18n();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameCkb, setNameCkb] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setError(null);
    if (editing.mode === "edit") {
      setCode(editing.category.code);
      setName(editing.category.name);
      setNameCkb(editing.category.nameCkb);
    } else {
      setCode("");
      setName("");
      setNameCkb("");
    }
  }, [editing]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!name.trim()) {
      setError("Category name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing.mode === "edit") {
        await apiClient.updateCategory(editing.category.id, { code, name, nameCkb });
        toast.success("Category updated");
      } else {
        await apiClient.createCategory({ code, name, nameCkb, parentId: editing.parent?.id ?? null });
        toast.success("Category added");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const parent = editing?.mode === "add" ? editing.parent : null;
  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing?.mode === "edit" ? t("Edit category") : t("Add category")}</DialogTitle>
          <DialogDescription>
            {parent
              ? t("New sub-class under: {path}", { path: categoryPathText(parent.id, index, locale) })
              : editing?.mode === "edit"
                ? t("Change the name or code of this category.")
                : t("New top-level class.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cat-code">{t("Code")}</Label>
              <Input id="cat-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="2512" dir="ltr" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cat-name">{t("Name (English) *")}</Label>
              <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} dir="ltr" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-ckb">{t("Name (Kurdish Sorani)")}</Label>
            <Input id="cat-ckb" value={nameCkb} onChange={(e) => setNameCkb(e.target.value)} dir="rtl" lang="ckb" />
          </div>
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(error)}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCsv("");
      setError(null);
    }
  }, [open]);

  async function loadFile(file: File | undefined) {
    if (file) setCsv(await file.text());
  }

  async function submit() {
    if (!csv.trim()) {
      setError("CSV content is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await apiClient.importCategories(csv);
      toast.success(t("Imported {created} categories ({skipped} skipped, {failed} without parent)", r));
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("Import classification (CSV)")}</DialogTitle>
          <DialogDescription>
            {t("Columns: code, name, parent_code, name_ckb. Use parent_code to place a row under an existing code; leave it empty for a top-level class. Existing codes are skipped.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input type="file" accept=".csv,.txt,text/csv" onChange={(e) => loadFile(e.target.files?.[0])} aria-label={t("Choose CSV file")} />
          <Textarea
            rows={8}
            dir="ltr"
            className="font-mono text-xs"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={"code,name,parent_code,name_ckb\n251201,Mobile App Developers,2512,"}
          />
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
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("Import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClassificationView() {
  const { t, locale } = useI18n();
  const { list, index, error, reload } = useCategories();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<JobCategory | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !list) return null;
    return list
      .filter((c) => c.name.toLowerCase().includes(q) || c.nameCkb.includes(query.trim()) || c.code.toLowerCase().includes(q))
      .slice(0, 100);
  }, [query, list]);

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiClient.deleteCategory(deleting.id);
      toast.success("Category deleted");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete category");
    } finally {
      setDeleteBusy(false);
    }
  }

  function renderRow(node: JobCategory, depth: number, showPath?: boolean): ReactNode {
    const kids = index?.children.get(node.id) ?? [];
    const open = expanded.has(node.id);
    return (
      <div key={node.id}>
        <div
          className="group flex items-center gap-2 border-b px-3 py-2 text-sm last:border-0 hover:bg-muted/30"
          style={{ paddingInlineStart: showPath ? 12 : 12 + depth * 20 }}
        >
          {kids.length > 0 && !showPath ? (
            <button
              type="button"
              onClick={() => toggle(node.id)}
              className="rounded p-0.5 hover:bg-muted"
              aria-label={open ? t("Collapse") : t("Expand")}
              aria-expanded={open}
            >
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          {node.code && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground" dir="ltr">
              {node.code}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{categoryName(node, locale)}</p>
            {showPath && (
              <p className="truncate text-xs text-muted-foreground">{categoryPathText(node.parentId, index, locale)}</p>
            )}
          </div>
          {(node._count?.jobs ?? 0) > 0 && (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {t("{n} jobs", { n: node._count?.jobs ?? 0 })}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("Actions for {name}", { name: node.name })}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {node.level < MAX_CATEGORY_DEPTH && (
                <DropdownMenuItem onClick={() => { setEditing({ mode: "add", parent: node }); if (!open) toggle(node.id); }}>
                  <Plus className="me-2 h-4 w-4" /> {t("Add sub-class")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setEditing({ mode: "edit", category: node })}>
                <Pencil className="me-2 h-4 w-4" /> {t("Edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600" onClick={() => setDeleting(node)}>
                <Trash2 className="me-2 h-4 w-4" /> {t("Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {open && !showPath && kids.map((k) => renderRow(k, depth + 1))}
      </div>
    );
  }

  const roots = index?.children.get(null) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Job Classification")}
        description={t("Organise jobs into classes, sub-classes and deeper levels. Starts with the ILO ISCO-08 standard; add your own levels anywhere.")}
        action={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="me-2 h-4 w-4" />
              {t("Import CSV")}
            </Button>
            <Button onClick={() => setEditing({ mode: "add", parent: null })}>
              <Plus className="me-2 h-4 w-4" />
              {t("Add class")}
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-8"
            placeholder={t("Search by code or name…")}
            aria-label={t("Search classification")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {!matches && list && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded(new Set(list.filter((c) => (index?.children.get(c.id)?.length ?? 0) > 0).map((c) => c.id)))}
            >
              {t("Expand all")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
              {t("Collapse all")}
            </Button>
          </div>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {!list && !error && <TableSkeleton rows={6} />}

      {list && index && (
        <div className="overflow-hidden rounded-xl border bg-card">
          {matches ? (
            matches.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">{t("No categories match your search")}</p>
            ) : (
              matches.map((m) => renderRow(m, 0, true))
            )
          ) : roots.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <Layers className="h-6 w-6" />
              {t("No classification yet")}
            </div>
          ) : (
            roots.map((r) => renderRow(r, 0))
          )}
        </div>
      )}

      {index && (
        <CategoryFormDialog editing={editing} onClose={() => setEditing(null)} onSaved={reload} index={index} />
      )}
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={reload} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("Delete “{name}”?", { name: deleting?.name ?? "" })}
        description={t("Only categories without sub-classes can be deleted. Jobs in it become unclassified.")}
        onConfirm={handleDelete}
        busy={deleteBusy}
      />
    </div>
  );
}
