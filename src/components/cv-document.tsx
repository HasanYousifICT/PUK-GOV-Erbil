"use client";

// The candidate CV, rendered with the design the administrator chose (Settings → CV design).

import { ReactNode } from "react";
import { Download, FileText, Mail, MapPin, Phone } from "lucide-react";
import { CustomFieldValue } from "@/components/candidate-fields";
import { apiClient, Candidate, CvDesign } from "@/lib/client";
import {
  CandidateField,
  CandidateSection,
  fieldLabel,
  groupFields,
  isEmptyValue,
  parseCustomData,
  sectionLabel,
} from "@/lib/candidate-fields";
import { Locale } from "@/lib/i18n-core";
import { useI18n } from "@/lib/i18n";

export const STANDARD_BLOCKS = [
  { id: "std:contact", label: "Contact" },
  { id: "std:summary", label: "Summary" },
  { id: "std:documents", label: "Documents" },
] as const;

type Item = { label: string; node: ReactNode; wide?: boolean };
type Block = { id: string; title: string; items?: Item[]; text?: string; chips?: string[] };

function buildBlocks(
  c: Candidate,
  fields: CandidateField[],
  sections: CandidateSection[],
  design: CvDesign,
  t: (s: string) => string,
  locale: Locale
): Block[] {
  const hidden = new Set(design.hiddenSections);
  const out: Block[] = [];
  const std = (id: string, block: Omit<Block, "id">) => {
    if (!hidden.has(id)) out.push({ id, ...block });
  };

  const contact: Item[] = [];
  if (c.email) contact.push({ label: t("Email"), node: <span dir="ltr">{c.email}</span> });
  if (c.phone) contact.push({ label: t("Phone"), node: <span dir="ltr">{c.phone}</span> });
  if (c.location) contact.push({ label: t("Location"), node: c.location });
  if (contact.length) std("std:contact", { title: t("Contact"), items: contact });

  if (c.notes.trim()) std("std:summary", { title: t("Summary"), text: c.notes });

  const data = parseCustomData(c.customData);
  for (const { section, fields: group } of groupFields(fields, sections)) {
    if (hidden.has(section.id)) continue;
    const items = group
      .filter((f) => !isEmptyValue(data[f.id]))
      .map((f) => ({
        label: fieldLabel(f, locale),
        node: <CustomFieldValue field={f} value={data[f.id]} />,
        wide: f.type === "table" || f.type === "longtext",
      }));
    if (items.length) out.push({ id: section.id, title: sectionLabel(section, locale), items });
  }

  if (c.resume) {
    std("std:documents", {
      title: t("Documents"),
      items: [
        {
          label: t("CV file"),
          node: (
            <a
              href={apiClient.resumeUrl(c.resume)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
            >
              <FileText className="h-4 w-4" />
              <span dir="auto">{c.resumeName || t("CV file")}</span>
              <Download className="h-3.5 w-3.5 print:hidden" />
            </a>
          ),
        },
      ],
    });
  }
  return out;
}

function Items({ items }: { items: Item[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className={`min-w-0 ${i.wide ? "sm:col-span-2" : ""}`}>
          <dt className="text-[11px] uppercase tracking-wide text-neutral-500">{i.label}</dt>
          <dd className="text-sm text-neutral-900">{i.node}</dd>
        </div>
      ))}
    </dl>
  );
}

function Chips({ chips, accent, onDark }: { chips: string[]; accent: string; onDark?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((s) => (
        <span
          key={s}
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            onDark
              ? { background: "rgba(255,255,255,0.18)", color: "#fff" }
              : { background: `${accent}1a`, color: accent }
          }
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function BlockBody({ b, accent }: { b: Block; accent: string }) {
  return (
    <>
      {b.text && <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">{b.text}</p>}
      {b.chips && <Chips chips={b.chips} accent={accent} />}
      {b.items && <Items items={b.items} />}
    </>
  );
}

const CONTACT_ICON: Record<string, typeof Mail> = { Email: Mail, Phone, Location: MapPin };

export function CvDocument({
  candidate,
  fields,
  sections,
  design,
  logoUrl,
  orgName,
}: {
  candidate: Candidate;
  fields: CandidateField[];
  sections: CandidateSection[];
  design: CvDesign;
  logoUrl: string;
  orgName: string;
}) {
  const { t, locale } = useI18n();
  const blocks = buildBlocks(candidate, fields, sections, design, t, locale);
  const accent = design.accent;
  const contact = blocks.find((b) => b.id === "std:contact");
  const rest = blocks.filter((b) => b.id !== "std:contact");
  const fontFamily = design.font === "serif" ? "Georgia, 'Times New Roman', serif" : undefined;
  const code = design.showCode && candidate.code ? candidate.code : "";

  const contactRow = (onDark: boolean) =>
    contact && (
      <div className={`mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm ${onDark ? "text-white/90" : "text-neutral-600"}`}>
        {contact.items!.map((i) => (
          <span key={i.label} className="inline-flex items-center gap-1.5">
            {(() => {
              const Icon = CONTACT_ICON[Object.keys(CONTACT_ICON).find((k) => t(k) === i.label) ?? ""];
              return Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null;
            })()}
            {i.node}
          </span>
        ))}
      </div>
    );

  const codeBadge = (onDark: boolean) =>
    code && (
      <span
        className="inline-block rounded-md px-2 py-0.5 font-mono text-xs"
        dir="ltr"
        style={onDark ? { background: "rgba(255,255,255,0.2)", color: "#fff" } : { background: `${accent}1a`, color: accent }}
      >
        {code}
      </span>
    );

  const logo = design.showLogo && logoUrl ? <img src={logoUrl} alt={orgName} className="h-10 w-10 rounded object-contain" /> : null;

  const footer = design.footerNote && (
    <p className="mt-8 border-t pt-3 text-center text-xs text-neutral-500">{design.footerNote}</p>
  );

  const section = (b: Block, style: "line" | "bar") => (
    <section key={b.id} className="break-inside-avoid">
      <h3
        className={
          style === "line"
            ? "mb-2 border-b pb-1 text-xs font-bold uppercase tracking-wider"
            : "mb-2 border-s-4 ps-2 text-sm font-bold uppercase tracking-wide"
        }
        style={{ color: accent, borderColor: accent }}
      >
        {b.title}
      </h3>
      <BlockBody b={b} accent={accent} />
    </section>
  );

  let body: ReactNode;
  if (design.layout === "modern") {
    body = (
      <>
        <header className="px-8 py-7 text-white" style={{ background: accent }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold leading-tight" dir="auto">
                {candidate.name}
              </h1>
              {design.headerNote && <p className="mt-1 text-sm text-white/85">{design.headerNote}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {logo && <div className="rounded bg-white p-1">{logo}</div>}
              {codeBadge(true)}
            </div>
          </div>
          {contactRow(true)}
        </header>
        <div className="space-y-5 px-8 py-6">{rest.map((b) => section(b, "bar"))}</div>
        {footer && <div className="px-8 pb-6">{footer}</div>}
      </>
    );
  } else if (design.layout === "sidebar") {
    const main = rest;
    body = (
      <div className="grid sm:grid-cols-[15rem_1fr]">
        <aside className="space-y-5 px-6 py-8 text-white" style={{ background: accent }}>
          {logo && <div className="inline-block rounded bg-white p-1">{logo}</div>}
          {code && <div>{codeBadge(true)}</div>}
          {contact && (
            <div className="space-y-2 text-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/80">{contact.title}</h3>
              {contact.items!.map((i) => (
                <div key={i.label} className="break-words">
                  {i.node}
                </div>
              ))}
            </div>
          )}
        </aside>
        <div className="space-y-5 px-8 py-8">
          <header>
            <h1 className="text-3xl font-bold leading-tight" style={{ color: accent }} dir="auto">
              {candidate.name}
            </h1>
            {design.headerNote && <p className="mt-1 text-sm text-neutral-600">{design.headerNote}</p>}
          </header>
          {main.map((b) => section(b, "line"))}
          {footer}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="space-y-5 px-8 py-8">
        <header className="flex items-start justify-between gap-4 border-b-2 pb-4" style={{ borderColor: accent }}>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold leading-tight" style={{ color: accent }} dir="auto">
              {candidate.name}
            </h1>
            {design.headerNote && <p className="mt-1 text-sm text-neutral-600">{design.headerNote}</p>}
            {contactRow(false)}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {logo}
            {codeBadge(false)}
          </div>
        </header>
        {rest.map((b) => section(b, "line"))}
        {footer}
      </div>
    );
  }

  return (
    <div
      id="cv-print"
      className="overflow-hidden rounded-xl border bg-white text-neutral-900 shadow-sm"
      style={{ fontFamily }}
    >
      {body}
    </div>
  );
}
