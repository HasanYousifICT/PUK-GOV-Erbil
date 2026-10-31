"use client";

// A dropdown with a search box — for fields that have many choices (districts, ministries, …).

import { ReactNode, useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string; group?: string };

function match(label: string, search: string): boolean {
  return label.toLowerCase().includes(search.trim().toLowerCase());
}

/** The searchable list itself (used inside a popover). */
export function OptionList({
  options,
  value,
  onPick,
  searchPlaceholder,
  emptyText,
}: {
  options: SelectOption[];
  value?: string;
  onPick: (v: string) => void;
  searchPlaceholder: string;
  emptyText: string;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, SelectOption[]>();
    for (const o of options) {
      const g = o.group ?? "";
      map.set(g, [...(map.get(g) ?? []), o]);
    }
    return Array.from(map.entries());
  }, [options]);

  return (
    <Command
      // search by the visible text (also keywords), case-insensitive, works for Kurdish/Arabic
      filter={(v, search, keywords) => (match(`${keywords?.join(" ") ?? ""}`, search) || match(v, search) ? 1 : 0)}
    >
      <CommandInput placeholder={searchPlaceholder} />
      <CommandList onWheel={(e) => e.stopPropagation()} className="max-h-64">
        <CommandEmpty>{emptyText}</CommandEmpty>
        {groups.map(([group, items]) => (
          <CommandGroup key={group} heading={group || undefined}>
            {items.map((o) => (
              <CommandItem key={o.value} value={o.value} keywords={[o.label, o.group ?? ""]} onSelect={() => onPick(o.value)}>
                <Check className={cn("me-2 h-4 w-4 shrink-0", value === o.value ? "opacity-100" : "opacity-0")} />
                <span className="min-w-0 flex-1 truncate" dir="auto">
                  {o.label}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  noneLabel,
  id,
  ariaLabel,
  className,
  disabled,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: SelectOption[];
  placeholder?: string;
  /** When set, a first entry with this text clears the value. */
  noneLabel?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const NONE = "__none__";
  const all = useMemo(
    () => (noneLabel ? [{ value: NONE, label: noneLabel }, ...options] : options),
    [options, noneLabel]
  );
  const current = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn("h-9 w-full justify-between px-3 font-normal", !current && "text-muted-foreground", className)}
        >
          <span className="min-w-0 flex-1 truncate text-start" dir="auto">
            {current ? current.label : placeholder ?? t("Select an option")}
          </span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
        <OptionList
          options={all}
          value={value ?? (noneLabel ? NONE : undefined)}
          searchPlaceholder={t("Search…")}
          emptyText={t("No results found.")}
          onPick={(v) => {
            onChange(v === NONE ? undefined : v);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** A button that opens a searchable list (e.g. “Add filter”). */
export function SearchablePickerButton({
  options,
  onPick,
  children,
  variant = "outline",
}: {
  options: SelectOption[];
  onPick: (v: string) => void;
  children: ReactNode;
  variant?: "outline" | "default" | "ghost";
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant={variant} size="sm">
          {children}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <OptionList
          options={options}
          searchPlaceholder={t("Search fields…")}
          emptyText={t("No results found.")}
          onPick={(v) => {
            onPick(v);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** A dropdown where several options can be ticked at once (with a search box). */
export function MultiSelect({
  values,
  onChange,
  options,
  placeholder,
  ariaLabel,
  className,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={cn("h-auto min-h-9 w-full justify-between gap-2 px-2.5 py-1 font-normal", className)}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-start">
            {values.length === 0 ? (
              <span className="px-0.5 text-muted-foreground">{placeholder ?? t("Select one or more options")}</span>
            ) : (
              values.map((v) => (
                <span key={v} className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary" dir="auto">
                  <span className="truncate">{labelOf(v)}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={t("Remove")}
                    className="rounded hover:bg-primary/20"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(v);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </span>
              ))
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
        <Command filter={(v, search, keywords) => (match(`${keywords?.join(" ") ?? ""}`, search) || match(v, search) ? 1 : 0)}>
          <CommandInput placeholder={t("Search…")} />
          <CommandList onWheel={(e) => e.stopPropagation()} className="max-h-64">
            <CommandEmpty>{t("No results found.")}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const on = values.includes(o.value);
                return (
                  <CommandItem key={o.value} value={o.value} keywords={[o.label]} onSelect={() => toggle(o.value)}>
                    <span className={cn("me-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate" dir="auto">
                      {o.label}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span>{t("{n} selected", { n: values.length })}</span>
          <span className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => onChange(options.map((o) => o.value))}>
              {t("Select all")}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" disabled={values.length === 0} onClick={() => onChange([])}>
              {t("Clear")}
            </Button>
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
