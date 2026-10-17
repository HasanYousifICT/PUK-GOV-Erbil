// OpenRecruitOS — job classification helpers (shared by client and server).

import type { Locale } from "@/lib/i18n-core";

/** Deepest allowed nesting (ISCO-08 uses 4 levels; the rest is for your own sub-levels). */
export const MAX_CATEGORY_DEPTH = 8;

export type JobCategory = {
  id: string;
  code: string;
  name: string;
  nameCkb: string;
  level: number;
  parentId: string | null;
  _count?: { jobs: number };
};

export type CategoryIndex = {
  byId: Map<string, JobCategory>;
  children: Map<string | null, JobCategory[]>;
};

const collator = new Intl.Collator("en", { numeric: true });

function compare(a: JobCategory, b: JobCategory) {
  if (a.code && b.code) return collator.compare(a.code, b.code);
  if (a.code) return -1;
  if (b.code) return 1;
  return collator.compare(a.name, b.name);
}

export function buildIndex(list: JobCategory[]): CategoryIndex {
  const byId = new Map<string, JobCategory>();
  const children = new Map<string | null, JobCategory[]>();
  for (const c of list) byId.set(c.id, c);
  for (const c of list) {
    const key = c.parentId && byId.has(c.parentId) ? c.parentId : null;
    const arr = children.get(key);
    if (arr) arr.push(c);
    else children.set(key, [c]);
  }
  for (const arr of children.values()) arr.sort(compare);
  return { byId, children };
}

/** Root → node chain for a category id (empty when unknown). */
export function pathTo(id: string | null | undefined, index: CategoryIndex): JobCategory[] {
  const path: JobCategory[] = [];
  let current = id ? index.byId.get(id) : undefined;
  while (current && path.length < 20) {
    path.unshift(current);
    current = current.parentId ? index.byId.get(current.parentId) : undefined;
  }
  return path;
}

/** The category itself plus every category below it. */
export function descendantIds(id: string, index: CategoryIndex): Set<string> {
  const out = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const next = stack.pop()!;
    for (const child of index.children.get(next) ?? []) {
      if (!out.has(child.id)) {
        out.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return out;
}

export function categoryName(c: JobCategory, locale: Locale): string {
  return locale === "ckb" && c.nameCkb ? c.nameCkb : c.name;
}

export function categoryLabel(c: JobCategory, locale: Locale): string {
  const name = categoryName(c, locale);
  return c.code ? `${c.code} · ${name}` : name;
}
