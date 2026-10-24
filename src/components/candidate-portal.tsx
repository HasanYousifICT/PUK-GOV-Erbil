"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, Loader2, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApplyView } from "@/components/apply-view";
import { CvDocument } from "@/components/cv-document";
import { apiClient, Candidate, PortalData } from "@/lib/client";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { useOrg } from "@/lib/org-context";

function CandidateLogin({ onBack, onLoggedIn }: { onBack: () => void; onLoggedIn: () => void }) {
  const { t } = useI18n();
  const { org } = useOrg();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) return setError("Username or phone number and password are required");
    setBusy(true);
    try {
      await apiClient.candidateLogin(username.trim(), password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-100/40 via-background to-background px-4 py-10">
      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t("Back")}
        </button>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <img src={org.logoUrl} alt={org.name} className="mb-3 h-12 w-12 object-contain" />
            <h1 className="text-xl font-bold">{t("Candidate login")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Sign in with your phone number (or username) and the password you received from us.")}
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="c-user">{t("Phone number or username")}</Label>
              <Input id="c-user" dir="ltr" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-pass">{t("Password")}</Label>
              <Input id="c-pass" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {t(error)}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("Sign in")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Candidate portal: login → application form (code shown) → the finished CV. */
export function CandidatePortal({ onExit }: { onExit: () => void }) {
  const { t } = useI18n();
  const { org } = useOrg();
  const [data, setData] = useState<PortalData | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [justSent, setJustSent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiClient.candidatePortal();
      setData(d);
      setCandidate(d.candidate);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function signOut() {
    try {
      await apiClient.candidateLogout();
    } catch {
      // ignore
    }
    setData(null);
    setCandidate(null);
    onExit();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return <CandidateLogin onBack={onExit} onLoggedIn={load} />;

  if (!candidate) {
    return (
      <ApplyView
        onBack={signOut}
        backLabel={t("Sign out")}
        portal={{
          data,
          onSubmitted: (c) => {
            setCandidate(c);
            setJustSent(true);
          },
        }}
      />
    );
  }

  /** Download the CV: the browser's print window with the CV only; choose "Save as PDF". */
  function downloadCv() {
    const before = document.title;
    document.title = `CV - ${candidate?.name ?? ""} - ${data?.account.code ?? ""}`.trim();
    const restore = () => {
      document.title = before;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-sky-100/40 via-background to-background px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserRound className="h-4 w-4" />
            <span dir="ltr">{data.account.username ?? data.account.phone}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <Button size="sm" onClick={downloadCv}>
              <Download className="me-1.5 h-4 w-4" /> {t("Download CV (PDF)")}
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="me-1.5 h-4 w-4" /> {t("Sign out")}
            </Button>
          </div>
        </div>
        <p className="mb-3 text-xs text-muted-foreground print:hidden">
          {t("“Download CV” opens the save window of your browser. Choose “Save as PDF” as the printer.")}
        </p>
        {justSent && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 print:hidden">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{t("Thank you!")}</p>
              <p className="text-sm">{t("Your application has been received. Our team will contact you if your profile matches.")}</p>
            </div>
          </div>
        )}
        <CvDocument
          candidate={candidate}
          fields={data.fields}
          sections={data.sections}
          design={data.design}
          logoUrl={org.logoUrl}
          orgName={org.name}
        />
      </div>
    </div>
  );
}
