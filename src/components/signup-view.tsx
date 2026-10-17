"use client";

import { FormEvent, useState } from "react";
import { Loader2, UserPlus, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, SessionUser } from "@/lib/client";
import { APP_BY, APP_COMPANY, APP_NAME, APP_TAGLINE, APP_WEBSITE, APP_WEBSITE_URL } from "@/lib/constants";

import { LanguageSwitcher, useI18n } from "@/lib/i18n";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupView({
  onSignup,
  onBackToSignIn,
  firstRun,
}: {
  onSignup: (user: SessionUser) => void;
  onBackToSignIn: () => void;
  firstRun: boolean;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setBusy(true);
    try {
      const user = await apiClient.register(name.trim(), email.trim(), password);
      toast.success(firstRun ? t("Workspace ready — welcome, {name}!", { name: user.name }) : t("Welcome aboard, {name}!", { name: user.name }));
      onSignup(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed";
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
          <img src="/logo.png" alt={t("OpenRecruitOS logo")} className="mb-4 h-16 w-16 drop-shadow-md" />
          <h1 className="text-2xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{APP_TAGLINE}</p>
          <p className="brand-gradient-text mt-0.5 text-xs font-medium uppercase tracking-wider">{APP_BY}</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">{APP_COMPANY}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold">
            {firstRun ? t("Set up your workspace") : t("Create your account")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {firstRun
              ? t("This instance has no accounts yet. Create the first one to open your recruitment workspace.")
              : t("Sign up to start managing jobs, candidates and interviews in this workspace.")}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">{t("Full name")}</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                placeholder={t("Priya Sharma")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
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
                autoComplete="new-password"
                placeholder={t("At least 6 characters")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t("Confirm password")}</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder={t("Repeat your password")}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={6}
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
              {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <UserPlus className="me-2 h-4 w-4" />}
              {busy ? t("Creating account…") : firstRun ? t("Create workspace account") : t("Create account")}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {t("Already have an account?")}{" "}
            <button
              type="button"
              onClick={onBackToSignIn}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("Sign in")}
            </button>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <p>
              {t("Passwords are hashed with bcrypt and sessions use signed, HttpOnly cookies. Everyone who signs up joins this self-hosted workspace as a recruiter.")}
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t("OpenRecruitOS Community Edition · Self-hosted · MIT licensed")}
        </p>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {t("A product of")} {APP_COMPANY} ·{" "}
          <a
            href={APP_WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {APP_WEBSITE}
          </a>
        </p>
      </div>
    </div>
  );
}
