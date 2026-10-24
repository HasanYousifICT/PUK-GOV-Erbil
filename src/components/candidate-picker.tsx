"use client";

import { useEffect, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiClient, Candidate } from "@/lib/client";
import { useI18n } from "@/lib/i18n";

/** Search-as-you-type candidate chooser — works with any number of candidates (asks the server, 20 at a time). */
export function CandidatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string, candidate: Candidate | null) => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState(false);

  // a candidate chosen from outside (opened from a profile): fetch its name
  useEffect(() => {
    if (!value) return setSelected(null);
    if (selected?.id === value) return;
    apiClient.getCandidate(value).then((c) => setSelected(c as unknown as Candidate)).catch(() => setSelected(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (value) return;
    let live = true;
    setBusy(true);
    const id = setTimeout(() => {
      apiClient
        .listCandidates(q.trim() || undefined, undefined, 1, 20)
        .then((r) => live && setResults(r.items))
        .catch(() => live && setResults([]))
        .finally(() => live && setBusy(false));
    }, q ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [q, value]);

  if (value && selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <span className="min-w-0 truncate">
          <Check className="me-1.5 inline h-4 w-4 text-primary" />
          {selected.name}
          {selected.phone ? <span className="ms-2 text-muted-foreground" dir="ltr">{selected.phone}</span> : null}
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
        <Input className="ps-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search by name, phone or e-mail")} aria-label={t("Select candidate")} />
      </div>
      <ul className="thin-scrollbar max-h-48 divide-y overflow-auto rounded-md border">
        {results.map((c) => (
          <li key={c.id}>
            <button type="button" className="block w-full px-3 py-2 text-start text-sm hover:bg-muted/50" onClick={() => { setSelected(c); onChange(c.id, c); }}>
              {c.name}
              <span className="ms-2 text-xs text-muted-foreground" dir="ltr">{c.phone || c.email}</span>
            </button>
          </li>
        ))}
        {!results.length && <li className="px-3 py-2 text-sm text-muted-foreground">{busy ? t("Loading…") : t("Nothing matches your search.")}</li>}
      </ul>
    </div>
  );
}
