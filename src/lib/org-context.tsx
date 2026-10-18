"use client";

// Organization branding (name, logo, …) shared by every screen.

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiClient, Org } from "@/lib/client";

const FALLBACK: Org = {
  name: "OpenRecruitOS",
  tagline: "",
  byline: "",
  company: "",
  website: "",
  websiteUrl: "",
  footer: "",
  logoUrl: "/logo.png",
  customLogo: false,
};

type Ctx = { org: Org; loaded: boolean; reload: () => Promise<void>; setOrg: (o: Org) => void };
const OrgContext = createContext<Ctx>({ org: FALLBACK, loaded: false, reload: async () => {}, setOrg: () => {} });

export function OrgProvider({ children }: { children: ReactNode }) {
  const [org, setOrg] = useState<Org>(FALLBACK);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      setOrg(await apiClient.getOrg());
    } catch {
      // keep fallback
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Browser tab title + icon follow the organization.
  useEffect(() => {
    if (!loaded) return;
    document.title = org.tagline ? `${org.name} — ${org.tagline}` : org.name;
    if (org.customLogo) {
      document.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']").forEach((l) => l.remove());
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = org.logoUrl;
      document.head.appendChild(link);
    }
  }, [org, loaded]);

  const value = useMemo(() => ({ org, loaded, reload, setOrg }), [org, loaded, reload]);
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export const useOrg = () => useContext(OrgContext);
