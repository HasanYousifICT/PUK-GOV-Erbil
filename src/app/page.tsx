"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiClient, SessionUser } from "@/lib/client";
import { LoginView } from "@/components/login-view";
import { SignupView } from "@/components/signup-view";
import { AppShell } from "@/components/app-shell";
import { useI18n } from "@/lib/i18n";

type AuthMode = "signin" | "signup";

export default function Page() {
  const { t } = useI18n();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [firstRun, setFirstRun] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .me()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // Detect a fresh deployment (zero accounts) so the UI offers first-run setup.
    apiClient
      .authStatus()
      .then((s) => {
        if (!cancelled) {
          setFirstRun(s.firstRun);
          setSignupOpen(s.signupOpen);
          setDemo(s.demo);
          if (s.firstRun) setMode("signup");
        }
      })
      .catch(() => {
        // status is cosmetic — ignore failures
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("Loading OpenRecruitOS…")}</p>
      </div>
    );
  }

  if (!user) {
    if (mode === "signup") {
      return (
        <SignupView
          firstRun={firstRun}
          onSignup={setUser}
          onBackToSignIn={() => setMode("signin")}
        />
      );
    }
    return (
      <LoginView
        onLogin={setUser}
        firstRun={firstRun}
        demo={demo}
        onSignUp={signupOpen ? () => setMode("signup") : undefined}
      />
    );
  }

  return (
    <AppShell
      user={user}
      onUserChange={setUser}
      onLogout={() => {
        setUser(null);
        setMode("signin");
      }}
    />
  );
}
