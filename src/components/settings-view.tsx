"use client";

import { FormEvent, useState } from "react";
import { Building2, KeyRound, ListChecks, Loader2, Palette, UserCog, Users, UsersRound, type LucideIcon } from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, SessionUser } from "@/lib/client";
import { PageHeader } from "@/components/shared";
import { CandidateFieldsSettings } from "@/components/candidate-fields";
import { OrganizationSettings, UsersSettings } from "@/components/admin-settings";
import { CandidateAccessSettings, CvDesignSettings } from "@/components/candidate-access-settings";

import { useI18n } from "@/lib/i18n";

export type SettingsTab = "profile" | "organization" | "users" | "access" | "fields" | "cv";

/** Sub-pages of Settings (shown as a submenu in the sidebar). `admin` ones are for administrators only. */
export const SETTINGS_TABS: { tab: SettingsTab; label: string; description: string; icon: LucideIcon; admin: boolean }[] = [
  { tab: "profile", label: "My account", description: "Your name and password.", icon: UserCog, admin: false },
  { tab: "organization", label: "Organization", description: "Name, logo and details shown across the system.", icon: Building2, admin: true },
  { tab: "users", label: "Users", description: "Staff accounts and their roles.", icon: Users, admin: true },
  { tab: "access", label: "Candidate access", description: "Logins and unique codes for candidates.", icon: UsersRound, admin: true },
  { tab: "fields", label: "Profile fields", description: "Sections and fields of the candidate profile and form.", icon: ListChecks, admin: true },
  { tab: "cv", label: "CV design", description: "How candidate CVs look.", icon: Palette, admin: true },
];

export function SettingsView({
  user,
  onUserChange,
  tab = "profile",
}: {
  user: SessionUser;
  onUserChange: (user: SessionUser) => void;
  tab?: SettingsTab;
}) {
  const { t } = useI18n();
  const current = SETTINGS_TABS.find((x) => x.tab === tab && (!x.admin || user.role === "admin")) ?? SETTINGS_TABS[0];
  tab = current.tab;
  const [name, setName] = useState(user.name);
  const [nameBusy, setNameBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setNameBusy(true);
    try {
      const updated = await apiClient.updateProfile(name.trim());
      onUserChange(updated);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile");
    } finally {
      setNameBusy(false);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    setPasswordBusy(true);
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t(current.label)} description={t(current.description)} />

      {tab === "profile" && (
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profile */}
        <form onSubmit={handleProfileSave} className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t("Profile")}</h2>
          </div>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-name">{t("Display name")}</Label>
              <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-email">{t("Email")}</Label>
              <Input id="settings-email" value={user.email} disabled />
              <p className="text-xs text-muted-foreground">
                {t("The account email cannot be changed in the Community Edition.")}
              </p>
            </div>
            <Button type="submit" disabled={nameBusy}>
              {nameBusy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("Save profile")}
            </Button>
          </div>
        </form>

        {/* Password */}
        <form onSubmit={handlePasswordChange} className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t("Change Password")}</h2>
          </div>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t("Current password")}</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("New password")}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("Confirm new password")}</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {passwordError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {t(passwordError)}
              </div>
            )}
            <Button type="submit" disabled={passwordBusy}>
              {passwordBusy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("Change password")}
            </Button>
          </div>
        </form>
      </div>

      )}

      {user.role === "admin" && (
        <>
          {tab === "organization" && <OrganizationSettings />}
          {tab === "users" && <UsersSettings me={user} />}
          {tab === "access" && <CandidateAccessSettings />}
          {tab === "fields" && <CandidateFieldsSettings />}
          {tab === "cv" && <CvDesignSettings />}
        </>
      )}
    </div>
  );
}
