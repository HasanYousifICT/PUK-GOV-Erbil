"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Building2, KeyRound, Loader2, MoreHorizontal, Pencil, Phone, Plus, Search, ShieldCheck, Trash2, Upload, UserCheck, UserPlus, UserX, Users, X } from "lucide-react";
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
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog, ErrorState, formatDate, TableSkeleton } from "@/components/shared";
import { apiClient, ManagedUser, SessionUser } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { useOrg } from "@/lib/org-context";
import { AREAS, AREA_INFO, Area, Level, Permissions, presetByKey, presetKeyFor, ROLE_PRESETS } from "@/lib/permissions";

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

const LEVELS: { value: Level; label: string }[] = [
  { value: "none", label: "No access" },
  { value: "view", label: "View only" },
  { value: "edit", label: "Can edit" },
];

const EMPTY_PERMS: Permissions = { candidates: "none", jobs: "none", applications: "none", interviews: "none", classification: "none", access: "none" };

function roleLabel(user: Pick<ManagedUser, "role" | "permissions">): string {
  const key = presetKeyFor(user.role, user.permissions);
  return key === "custom" ? "Custom role" : presetByKey(key)?.label ?? "Custom role";
}

function UserDialog({
  editing,
  me,
  onClose,
  onSaved,
}: {
  editing: UserEdit | null;
  me: SessionUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [preset, setPreset] = useState("recruiter");
  const [perms, setPerms] = useState<Permissions>(EMPTY_PERMS);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdminRole = preset === "admin";
  const editingSelf = editing?.mode === "edit" && editing.user.id === me.id;

  useEffect(() => {
    if (!editing) return;
    setError(null);
    setPassword("");
    if (editing.mode === "edit") {
      const u = editing.user;
      setName(u.name);
      setEmail(u.email);
      setPhone(u.phone);
      setTitle(u.title);
      setPreset(presetKeyFor(u.role, u.permissions));
      setPerms(u.permissions);
      setActive(u.active);
    } else {
      setName("");
      setEmail("");
      setPhone("");
      setTitle("");
      setPreset("recruiter");
      setPerms({ ...ROLE_PRESETS[1].permissions });
      setActive(true);
    }
  }, [editing]);

  function pickPreset(key: string) {
    setPreset(key);
    const p = presetByKey(key);
    if (p) setPerms({ ...p.permissions });
  }

  function setLevel(area: Area, level: Level) {
    setPerms((p) => ({ ...p, [area]: level }));
    setPreset("custom");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    const role = isAdminRole ? "admin" : "recruiter";
    try {
      if (editing.mode === "add") {
        await apiClient.createUser({ name, email, phone, title, password, role, permissions: perms });
        toast.success("User added");
      } else {
        await apiClient.updateUser(editing.user.id, { name, phone, title, role, permissions: perms, active });
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing?.mode === "edit" ? t("Edit user") : t("Add user")}</DialogTitle>
          <DialogDescription>
            {editing?.mode === "edit"
              ? t("Change the details, the role and what this person is allowed to do.")
              : t("Create an account. Share the email and password with the user; they can change the password in Settings.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="u-name">{t("Full Name *")}</Label>
              <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-phone">{t("Phone")} *</Label>
              <Input id="u-phone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+964 750 000 0000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-email">{t("Email *")}</Label>
              <Input id="u-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} disabled={editing?.mode === "edit"} />
            </div>
            {editing?.mode === "add" && (
              <div className="space-y-2">
                <Label htmlFor="u-pass">{t("Password *")}</Label>
                <PasswordInput id="u-pass" value={password} onChange={setPassword} placeholder={t("At least 6 characters")} />
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="u-title">{t("Task / responsibility")}</Label>
              <Input id="u-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("e.g. Interviews for the engineering jobs")} />
              <p className="text-xs text-muted-foreground">{t("Shown in the users list so everyone knows who does what.")}</p>
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t("The full name and the phone number must be different for every user.")}</p>

          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">{t("Role and permissions")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("Role")}</Label>
              <Select value={preset} onValueChange={pickPreset}>
                <SelectTrigger aria-label={t("Role")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_PRESETS.map((r) => (
                    <SelectItem key={r.key} value={r.key} disabled={editingSelf && r.key !== "admin"}>
                      {t(r.label)} — {t(r.description)}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom" disabled={editingSelf}>
                    {t("Custom role")} — {t("Choose exactly what this person can do.")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isAdminRole ? (
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                {t("Administrators can do everything, including managing users and settings.")}
              </p>
            ) : (
              <ul className="divide-y rounded-lg border bg-card">
                {AREAS.map((area) => (
                  <li key={area} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t(AREA_INFO[area].label)}</p>
                      <p className="text-xs text-muted-foreground">{t(AREA_INFO[area].hint)}</p>
                    </div>
                    <div role="radiogroup" aria-label={t(AREA_INFO[area].label)} className="inline-flex overflow-hidden rounded-lg border text-xs">
                      {LEVELS.map((l) => (
                        <button
                          key={l.value}
                          type="button"
                          role="radio"
                          aria-checked={perms[area] === l.value}
                          onClick={() => setLevel(area, l.value)}
                          className={`px-2.5 py-1.5 transition-colors ${
                            perms[area] === l.value
                              ? l.value === "edit"
                                ? "bg-primary text-primary-foreground"
                                : l.value === "view"
                                  ? "bg-sky-100 text-sky-900"
                                  : "bg-muted text-foreground"
                              : "bg-card text-muted-foreground hover:bg-muted/60"
                          }`}
                        >
                          {t(l.label)}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {editing?.mode === "edit" && (
            <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">{t("Account active")}</p>
                <p className="text-xs text-muted-foreground">{t("A disabled account cannot sign in. Nothing is deleted.")}</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} disabled={editingSelf} aria-label={t("Account active")} />
            </div>
          )}

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
            <PasswordInput id="r-pass" value={password} onChange={setPassword} placeholder={t("At least 6 characters")} />
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

function PermissionChips({ user }: { user: ManagedUser }) {
  const { t } = useI18n();
  if (user.role === "admin") return <span className="text-xs text-muted-foreground">{t("Full access")}</span>;
  const edit = AREAS.filter((a) => user.permissions[a] === "edit");
  const view = AREAS.filter((a) => user.permissions[a] === "view");
  if (!edit.length && !view.length) return <span className="text-xs text-muted-foreground">{t("No access")}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {edit.map((a) => (
        <Badge key={a} className="bg-primary/10 font-normal text-primary hover:bg-primary/10">
          {t(AREA_INFO[a].label)}
        </Badge>
      ))}
      {view.map((a) => (
        <Badge key={a} variant="outline" className="font-normal text-muted-foreground">
          {t(AREA_INFO[a].label)} · {t("View only")}
        </Badge>
      ))}
    </div>
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
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [areaFilter, setAreaFilter] = useState<"all" | Area>("all");

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

  const shown = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return users.filter((u) => {
      if (roleFilter !== "all" && presetKeyFor(u.role, u.permissions) !== roleFilter) return false;
      if (statusFilter === "active" && !u.active) return false;
      if (statusFilter === "disabled" && u.active) return false;
      if (areaFilter !== "all" && u.permissions[areaFilter] === "none") return false;
      if (!q) return true;
      if ([u.name, u.email, u.phone, u.title].some((v) => v.toLowerCase().includes(q))) return true;
      return qDigits.length >= 3 && u.phone.replace(/\D/g, "").includes(qDigits);
    });
  }, [users, search, roleFilter, statusFilter, areaFilter]);

  const filtering = search.trim() !== "" || roleFilter !== "all" || statusFilter !== "all" || areaFilter !== "all";

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

  async function toggleActive(u: ManagedUser) {
    try {
      await apiClient.updateUser(u.id, { active: !u.active });
      toast.success(u.active ? "Account disabled" : "Account enabled");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
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
            {t("Only administrators can add users. Give each person a role and the exact areas they may use.")}
          </p>
        </div>
        <Button onClick={() => setEditing({ mode: "add" })}>
          <UserPlus className="me-2 h-4 w-4" />
          {t("Add user")}
        </Button>
      </div>

      {users && users.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search by name, email, phone or task")}
                aria-label={t("Search by name, email, phone or task")}
                className="ps-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44" aria-label={t("Role")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All roles")}</SelectItem>
                {ROLE_PRESETS.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {t(r.label)}
                  </SelectItem>
                ))}
                <SelectItem value="custom">{t("Custom role")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={areaFilter} onValueChange={(v) => setAreaFilter(v as typeof areaFilter)}>
              <SelectTrigger className="w-44" aria-label={t("Area")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Any area")}</SelectItem>
                {AREAS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {t(AREA_INFO[a].label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-40" aria-label={t("Status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All statuses")}</SelectItem>
                <SelectItem value="active">{t("Active")}</SelectItem>
                <SelectItem value="disabled">{t("Disabled")}</SelectItem>
              </SelectContent>
            </Select>
            {filtering && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("all");
                  setStatusFilter("all");
                  setAreaFilter("all");
                }}
              >
                <X className="me-1 h-4 w-4" /> {t("Clear filters")}
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("Showing {n} of {total}", { n: shown.length, total: users.length })}</p>
        </>
      )}

      <div className="mt-3">
        {error && <ErrorState message={error} onRetry={load} />}
        {!users && !error && <TableSkeleton rows={3} />}
        {users && shown.length === 0 && (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{t("Nothing matches your search.")}</p>
        )}
        {shown.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {shown.map((u) => (
              <li key={u.id} className={`flex flex-wrap items-start gap-3 px-3 py-3 ${u.active ? "" : "bg-muted/40"}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                  {u.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium">
                    {u.name}
                    {u.id === me.id && <span className="ms-2 text-xs font-normal text-muted-foreground">({t("you")})</span>}
                  </p>
                  {u.title && <p className="truncate text-xs text-foreground/80">{u.title}</p>}
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground" dir="ltr">
                    <span>{u.email}</span>
                    {u.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {u.phone}
                      </span>
                    )}
                    <span>{u.lastLoginAt ? `${t("Last sign-in")}: ${formatDate(u.lastLoginAt)}` : formatDate(u.createdAt)}</span>
                  </p>
                  <PermissionChips user={u} />
                </div>
                <div className="flex items-center gap-2">
                  {!u.active && (
                    <Badge variant="outline" className="gap-1 font-normal text-red-600">
                      <UserX className="h-3 w-3" /> {t("Disabled")}
                    </Badge>
                  )}
                  <Badge variant={u.role === "admin" ? "default" : "secondary"} className="font-normal">
                    {t(roleLabel(u))}
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
                          <DropdownMenuItem onClick={() => toggleActive(u)}>
                            {u.active ? <UserX className="me-2 h-4 w-4" /> : <UserCheck className="me-2 h-4 w-4" />}
                            {u.active ? t("Disable account") : t("Enable account")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleting(u)}>
                            <Trash2 className="me-2 h-4 w-4" /> {t("Delete")}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <UserDialog editing={editing} me={me} onClose={() => setEditing(null)} onSaved={load} />
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
