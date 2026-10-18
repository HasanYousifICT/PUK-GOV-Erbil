"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Building2, KeyRound, Loader2, MoreHorizontal, Pencil, Plus, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { toast } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog, ErrorState, formatDate, TableSkeleton } from "@/components/shared";
import { apiClient, ManagedUser, SessionUser } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { useOrg } from "@/lib/org-context";

/* ------------------------------ Organization ------------------------------ */

export function OrganizationSettings() {
  const { t } = useI18n();
  const { org, setOrg } = useOrg();
  const [form, setForm] = useState({ name: "", tagline: "", byline: "", company: "", website: "", websiteUrl: "", footer: "" });
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm({
      name: org.name,
      tagline: org.tagline,
      byline: org.byline,
      company: org.company,
      website: org.website,
      websiteUrl: org.websiteUrl,
      footer: org.footer,
    });
  }, [org]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("Organization name is required");
    setBusy(true);
    try {
      setOrg(await apiClient.updateOrg(form));
      toast.success("Organization updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function logo(file: File | undefined, remove = false) {
    if (!remove && !file) return;
    setLogoBusy(true);
    setError(null);
    try {
      setOrg(remove ? await apiClient.removeLogo() : await apiClient.uploadLogo(file!));
      toast.success(remove ? "Logo removed" : "Logo updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLogoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">{t("Organization")}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("The name, logo and details shown on the home page, the login page, the application form and the sidebar. Leave a field empty to hide it.")}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 p-3">
        <img src={org.logoUrl} alt="" className="h-16 w-16 rounded-md bg-white object-contain p-1" />
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("Logo")}</p>
          <p className="text-xs text-muted-foreground">{t("PNG, JPG or WebP · max 2 MB · square images look best")}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" disabled={logoBusy} onClick={() => fileRef.current?.click()}>
              {logoBusy ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="me-1.5 h-3.5 w-3.5" />}
              {t("Upload logo")}
            </Button>
            {org.customLogo && (
              <Button type="button" size="sm" variant="ghost" disabled={logoBusy} onClick={() => logo(undefined, true)}>
                {t("Use default logo")}
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            className="hidden"
            aria-label={t("Upload logo")}
            onChange={(e) => logo(e.target.files?.[0])}
          />
        </div>
      </div>

      <form onSubmit={save} className="mt-4 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="org-name">{t("Organization name *")}</Label>
            <Input id="org-name" value={form.name} onChange={(e) => set("name")(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-company">{t("Company (legal name)")}</Label>
            <Input id="org-company" value={form.company} onChange={(e) => set("company")(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="org-tagline">{t("Tagline")}</Label>
            <Input id="org-tagline" value={form.tagline} onChange={(e) => set("tagline")(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-byline">{t("Byline (e.g. “By …”)")}</Label>
            <Input id="org-byline" value={form.byline} onChange={(e) => set("byline")(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-footer">{t("Footer text")}</Label>
            <Input id="org-footer" value={form.footer} onChange={(e) => set("footer")(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-site">{t("Website (display text)")}</Label>
            <Input id="org-site" dir="ltr" value={form.website} onChange={(e) => set("website")(e.target.value)} placeholder="example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-url">{t("Website link")}</Label>
            <Input id="org-url" dir="ltr" value={form.websiteUrl} onChange={(e) => set("websiteUrl")(e.target.value)} placeholder="https://example.com" />
          </div>
        </div>
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {t(error)}
          </div>
        )}
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t("Save organization")}
        </Button>
      </form>
    </div>
  );
}

/* --------------------------------- Users ---------------------------------- */

type UserEdit = { mode: "add" } | { mode: "edit"; user: ManagedUser };

function UserDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: UserEdit | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "recruiter">("recruiter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setError(null);
    setPassword("");
    if (editing.mode === "edit") {
      setName(editing.user.name);
      setEmail(editing.user.email);
      setRole(editing.user.role);
    } else {
      setName("");
      setEmail("");
      setRole("recruiter");
    }
  }, [editing]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      if (editing.mode === "add") {
        await apiClient.createUser({ name, email, password, role });
        toast.success("User added");
      } else {
        await apiClient.updateUser(editing.user.id, { name, role });
        toast.success("User updated");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing?.mode === "edit" ? t("Edit user") : t("Add user")}</DialogTitle>
          <DialogDescription>
            {editing?.mode === "edit"
              ? t("Change the name or the role of this user.")
              : t("Create an account. Share the email and password with the user; they can change the password in Settings.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="u-name">{t("Full Name *")}</Label>
            <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-email">{t("Email *")}</Label>
            <Input id="u-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} disabled={editing?.mode === "edit"} />
          </div>
          {editing?.mode === "add" && (
            <div className="space-y-2">
              <Label htmlFor="u-pass">{t("Password *")}</Label>
              <Input id="u-pass" type="text" dir="ltr" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("At least 6 characters")} />
            </div>
          )}
          <div className="space-y-2">
            <Label>{t("Role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "recruiter")}>
              <SelectTrigger aria-label={t("Role")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recruiter">{t("Recruiter — manages jobs and candidates")}</SelectItem>
                <SelectItem value="admin">{t("Administrator — also manages users and settings")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(error)}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: ManagedUser | null; onClose: () => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPassword("");
    setError(null);
  }, [user]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.updateUser(user.id, { password });
      toast.success("Password reset");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Reset password for {name}", { name: user?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("Set a new password and share it with the user.")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="r-pass">{t("New password")}</Label>
            <Input id="r-pass" type="text" dir="ltr" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("At least 6 characters")} />
          </div>
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(error)}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("Reset password")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersSettings({ me }: { me: SessionUser }) {
  const { t } = useI18n();
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserEdit | null>(null);
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function load() {
    try {
      setUsers(await apiClient.listUsers());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiClient.deleteUser(deleting.id);
      toast.success("User deleted");
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete user");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t("Users")}</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("Only administrators can add users. There is no public sign-up.")}
          </p>
        </div>
        <Button onClick={() => setEditing({ mode: "add" })}>
          <UserPlus className="me-2 h-4 w-4" />
          {t("Add user")}
        </Button>
      </div>

      <div className="mt-4">
        {error && <ErrorState message={error} onRetry={load} />}
        {!users && !error && <TableSkeleton rows={3} />}
        {users && (
          <ul className="divide-y rounded-lg border">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {u.name}
                    {u.id === me.id && <span className="ms-2 text-xs font-normal text-muted-foreground">({t("you")})</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    {u.email} · {formatDate(u.createdAt)}
                  </p>
                </div>
                <Badge variant={u.role === "admin" ? "default" : "secondary"} className="font-normal">
                  {u.role === "admin" ? t("Administrator") : t("Recruiter")}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("Actions for {name}", { name: u.name })}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing({ mode: "edit", user: u })}>
                      <Pencil className="me-2 h-4 w-4" /> {t("Edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setResetting(u)}>
                      <KeyRound className="me-2 h-4 w-4" /> {t("Reset password")}
                    </DropdownMenuItem>
                    {u.id !== me.id && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleting(u)}>
                          <Trash2 className="me-2 h-4 w-4" /> {t("Delete")}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </div>

      <UserDialog editing={editing} onClose={() => setEditing(null)} onSaved={load} />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("Delete user “{name}”?", { name: deleting?.name ?? "" })}
        description={t("This account will no longer be able to sign in.")}
        onConfirm={handleDelete}
        busy={deleteBusy}
      />
    </div>
  );
}
