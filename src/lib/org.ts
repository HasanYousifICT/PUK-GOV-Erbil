// Server: organization branding (name, logo, …). One row, id "org".
import { db } from "@/lib/db";

export type OrgInfo = {
  name: string;
  tagline: string;
  byline: string;
  company: string;
  website: string;
  websiteUrl: string;
  footer: string;
  bannerName: string;
  version: string;
  copyright: string;
  logoUrl: string; // always usable in <img src>
  customLogo: boolean;
};

export const ORG_DEFAULTS = {
  name: "OpenRecruitOS",
  tagline: "The Open Source Recruitment Operating System",
  byline: "By Attitude360",
  company: "Attitude TalentBridge LLP",
  website: "attitude360.in",
  websiteUrl: "https://attitude360.in",
  footer: "OpenRecruitOS Community Edition · Self-hosted · MIT licensed",
  bannerName: "",
  version: "",
  copyright: "",
};

export async function getOrg(): Promise<OrgInfo> {
  let row: Awaited<ReturnType<typeof db.organization.findUnique>> = null;
  try {
    row = await db.organization.findUnique({ where: { id: "org" } });
  } catch {
    row = null;
  }
  if (!row) return { ...ORG_DEFAULTS, logoUrl: "/logo.png", customLogo: false };
  const custom = !!row.logo;
  return {
    name: row.name,
    tagline: row.tagline,
    byline: row.byline,
    company: row.company,
    website: row.website,
    websiteUrl: row.websiteUrl,
    footer: row.footer,
    bannerName: row.bannerName,
    version: row.version,
    copyright: row.copyright,
    logoUrl: custom ? `/api/public/logo?v=${row.logoVersion}` : "/logo.png",
    customLogo: custom,
  };
}
