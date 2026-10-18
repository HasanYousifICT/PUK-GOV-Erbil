"use client";

import { ArrowRight, Briefcase, LogIn } from "lucide-react";
import { useOrg } from "@/lib/org-context";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";

/** Public landing page: candidates apply, staff sign in. */
export function HomeView({ onApply, onStaff }: { onApply: () => void; onStaff: () => void }) {
  const { t } = useI18n();
  const { org } = useOrg();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-100/40 via-background to-background px-4 py-10">
      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-2xl">
        <div className="mb-10 flex flex-col items-center text-center">
          <img src={org.logoUrl} alt={org.name} className="mb-4 h-16 w-16 drop-shadow-md object-contain" />
          <h1 className="text-3xl font-bold tracking-tight">{org.name}</h1>
          {org.tagline && <p className="mt-1 text-sm text-muted-foreground">{org.tagline}</p>}
          {org.byline && <p className="brand-gradient-text mt-0.5 text-xs font-medium uppercase tracking-wider">{org.byline}</p>}
          {org.company && <p className="mt-0.5 text-xs font-medium text-muted-foreground">{org.company}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={onApply}
            className="group rounded-2xl border bg-card p-6 text-start shadow-sm transition-colors hover:border-primary hover:bg-primary/5"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Briefcase className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">{t("Candidate login")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Sign in with the username and password you received to fill in your application and see your CV.")}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              {t("Sign in")} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
            </span>
          </button>

          <button
            type="button"
            onClick={onStaff}
            className="group rounded-2xl border bg-card p-6 text-start shadow-sm transition-colors hover:border-primary hover:bg-primary/5"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LogIn className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">{t("Staff login")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Recruiters and administrators sign in to manage jobs and candidates.")}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              {t("Sign in")} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
