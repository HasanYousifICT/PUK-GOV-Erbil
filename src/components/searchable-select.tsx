"use client";

// A dropdown with a search box — for fields that have many choices (districts, ministries, …).

import { ReactNode, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
