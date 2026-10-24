"use client";

// The thin banner at the bottom of every page: name · version · copyright (set by the administrator in Settings → Banner).

import { useOrg } from "@/lib/org-context";

export function AppBanner() {
  const { org } = useOrg();
  const parts = [org.bannerName, org.version && `v${org.version.replace(/^v/i, "")}`, org.copyright].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <footer className="px-4 pb-16 pt-4 text-center text-xs text-muted-foreground print:hidden lg:pb-4" dir="auto">
      {parts.join("  ·  ")}
    </footer>
  );
}
