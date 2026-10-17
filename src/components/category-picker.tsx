"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/client";
import {
  buildIndex,
  categoryLabel,
  categoryName,
  CategoryIndex,
  JobCategory,
  pathTo,
} from "@/lib/categories";
import { useI18n } from "@/lib/i18n";

const NONE = "__none__";

/** Loads the classification tree once and shares it between pickers. */
let cache: JobCategory[] | null = null;
let inflight: Promise<JobCategory[]> | null = null;

export function invalidateCategories() {
  cache = null;
}

export function useCategories() {
  const [list, setList] = useState<JobCategory[] | null>(cache);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (cache && version === 0) return;
    let cancelled = false;
    if (!inflight || version > 0) {
      inflight = apiClient.listCategories().finally(() => {
        inflight = null;
      });
    }
    inflight
      .then((rows) => {
        cache = rows;
        if (!cancelled) {
          setList(rows);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load categories");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const index = useMemo<CategoryIndex | null>(() => (list ? buildIndex(list) : null), [list]);
  return { list, index, error, reload: () => { invalidateCategories(); setVersion((v) => v + 1); } };
}

/**
 * Cascading selects: pick a top-level class, then (when it has children) a
 * sub-class, and so on, as deep as the tree goes. Any level can be the final choice.
 */
export function CategoryPicker({
  value,
  onChange,
  index,
}: {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  index: CategoryIndex | null;
}) {
  const { t, locale } = useI18n();
  if (!index) return <p className="text-sm text-muted-foreground">{t("Loading classification…")}</p>;

  const path = pathTo(value, index);
  const last = path[path.length - 1];
  const lastHasChildren = last ? (index.children.get(last.id)?.length ?? 0) > 0 : false;

  // One select per chain level: the roots, then the children of each chosen node.
  const levels: { parentId: string | null; options: JobCategory[]; selected: string }[] = [];
  const roots = index.children.get(null) ?? [];
  levels.push({ parentId: null, options: roots, selected: path[0]?.id ?? NONE });
  path.forEach((node, i) => {
    const kids = index.children.get(node.id) ?? [];
    if (kids.length) levels.push({ parentId: node.id, options: kids, selected: path[i + 1]?.id ?? NONE });
  });

  return (
    <div className="space-y-2">
      {levels.map((lvl, i) => (
        <Select
          key={lvl.parentId ?? "root"}
          value={lvl.selected}
          onValueChange={(v) => {
            if (v === NONE) onChange(lvl.parentId);
            else onChange(v);
          }}
        >
          <SelectTrigger aria-label={t("Classification level {n}", { n: i + 1 })}>
            <SelectValue placeholder={i === 0 ? t("Select class") : t("Select sub-class (optional)")} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={NONE}>{i === 0 ? t("No classification") : t("— (stop at this level)")}</SelectItem>
            {lvl.options.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {categoryLabel(c, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {last && !lastHasChildren && (
        <p className="text-xs text-muted-foreground">{t("This is the most specific level.")}</p>
      )}
    </div>
  );
}

/** Breadcrumb text such as "Professionals › ICT Professionals › Software Developers". */
export function categoryPathText(id: string | null | undefined, index: CategoryIndex | null, locale: "en" | "ckb") {
  if (!index || !id) return "";
  return pathTo(id, index)
    .map((c) => categoryName(c, locale))
    .join(locale === "ckb" ? " ‹ " : " › ");
}

/** Compact filter control: a button that opens the cascading picker in a popover. */
export function CategoryFilter({
  value,
  onChange,
  index,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  index: CategoryIndex | null;
}) {
  const { t, locale } = useI18n();
  const text = categoryPathText(value, index, locale);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="max-w-full justify-start gap-2 sm:max-w-xs">
          <Layers className="h-4 w-4 shrink-0" />
          <span className="truncate">{text || t("All classifications")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <CategoryPicker value={value} onChange={onChange} index={index} />
        {value && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            {t("Clear")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
