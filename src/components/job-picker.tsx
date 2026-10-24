"use client";

import { useEffect, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiClient, JobLite } from "@/lib/client";
import { useI18n } from "@/lib/i18n";

/** Search-as-you-type job chooser for any number of jobs (the server returns 30 at a time). */
export function JobPicker({
  value,
  onChange,
  categoryId,
  status,
  disabled,
  compact,
}: {
  value: string;
  onChange: (id: string, job: JobLite | null) => void;
  categoryId?: string | null;
  status?: string;
  disabled?: boolean;
  /** smaller box for filter bars */
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<JobLite[]>([]);
  const [selected, setSelected] = useState<JobLite | null>(null);
  const [busy, setBusy] = useState(false);
  const [openList, setOpenList] = useState(false);

  useEffect(() => {
    if (!value) return setSelected(null);
    if (selected?.id === value) return;
    apiClient.getJob(value).then((j) => setSelected(j as unknown as JobLite)).catch(() => setSelected(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (value || disabled) return;
    let live = true;
    setBusy(true);
    const id = setTimeout(() => {
      apiClient
        .searchJobs({ q: q.trim() || undefined, status, categoryId: categoryId || undefined, limit: 30 })
        .then((r) => live && setResults(r))
        .catch(() => live && setResults([]))
        .finally(() => live && setBusy(false));
    }, q ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [q, value, status, categoryId, disabled]);

  if (value && selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <span className="min-w-0 truncate">
          <Check className="me-1.5 inline h-4 w-4 text-primary" />
          {selected.title}
          {selected.location ? <span className="ms-2 text-muted-foreground">{selected.location}</span> : null}
        </span>
        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setSelected(null); setQ(""); onChange("", null); }} aria-label={t("Clear")}>
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="ps-8"
          value={q}
          disabled={disabled}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpenList(true)}
          placeholder={t("Search jobs…")}
          aria-label={t("Select job")}
        />
      </div>
      {(!compact || openList) && !disabled && (
        <ul className="thin-scrollbar max-h-48 divide-y overflow-auto rounded-md border bg-card">
          {results.map((j) => (
            <li key={j.id}>
              <button type="button" className="block w-full px-3 py-2 text-start text-sm hover:bg-muted/50" onClick={() => { setSelected(j); setOpenList(false); onChange(j.id, j); }}>
                {j.title}
                {j.location ? <span className="ms-2 text-xs text-muted-foreground">{j.location}</span> : null}
              </button>
            </li>
          ))}
          {!results.length && <li className="px-3 py-2 text-sm text-muted-foreground">{busy ? t("Loading…") : t("No open jobs available")}</li>}
        </ul>
      )}
    </div>
  );
}
