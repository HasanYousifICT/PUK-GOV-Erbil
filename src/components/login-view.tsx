"use client";

import { FormEvent, useState } from "react";
import { Loader2, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, SessionUser } from "@/lib/client";
import { useOrg } from "@/lib/org-context";

import { LanguageSwitcher, useI18n } from "@/lib/i18n";
export function LoginView({
  onLogin,
  onSignUp,
  firstRun = false,
  demo = false,
  onBack,
}: {
  onLogin: (user: SessionUser) => void;
  onSignUp?: () => void;
  firstRun?: boolean;
  demo?: boolean;
  onBack?: () => void;
}) {
  const { t } = useI18n();
  const { org } = useOrg();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await apiClient.login(email, password);
      toast.success(t("Welcome back, {name}", { name: user.name }));
      onLogin(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-100/40 via-background to-background px-4 py-10">
      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={org.logoUrl} alt={org.name} className="mb-4 h-16 w-16 drop-shadow-md object-contain" />
          <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
          {org.tagline && <p className="mt-1 text-sm text-muted-foreground">{org.tagline}</p>}
          {org.byline && <p className="brand-gradient-text mt-0.5 text-xs font-medium uppercase tracking-wider">{org.byline}</p>}
          {org.company && <p className="mt-0.5 text-xs font-medium text-muted-foreground">{org.company}</p>}
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold">{t("Sign in to your workspace")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Use your recruiter account to access the dashboard.")}
          </p>

          {firstRun && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-800">
              <UserPlus className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {t("This instance has no accounts yet.")}{" "}
                <button
                  type="button"
                  onClick={onSignUp}
                  className="font-semibold underline underline-offset-2"
                >
                  {t("Create your admin account")}
                </button>{" "}
                {t("to get started.")}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">{t("Email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("Password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {t(error)}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <LogIn className="me-2 h-4 w-4" />}
              {busy ? t("Signing in…") : t("Sign in")}
            </Button>
          </form>

          {onBack && (
            <div className="mt-4 text-center">
              <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
                {t("Back to home")}
              </button>
            </div>
          )}

          {onSignUp && !firstRun && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {t("Don't have an account?")}{" "}
              <button
                type="button"
                onClick={onSignUp}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("Sign up")}
              </button>
            </div>
          )}

          {demo && (
          <div className="mt-6 flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <p>
              <span className="font-medium text-foreground">{t("Demo account")}</span> {t("— email")}{" "}
              <code className="rounded bg-background px-1 py-0.5 font-mono">admin@attitude360.com</code>{t(", password")}{" "}
              <code className="rounded bg-background px-1 py-0.5 font-mono">admin123</code>
            </p>
          </div>
          )}
        </div>

        {org.footer && <p className="mt-6 text-center text-xs text-muted-foreground">{org.footer}</p>}
        {(org.company || org.website) && (
          <p className="mt-1 text-center text-xs text-muted-foreground">
            {org.company}
            {org.company && org.website ? " · " : ""}
            {org.website && (
              <a
                href={org.websiteUrl || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {org.website}
              </a>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
