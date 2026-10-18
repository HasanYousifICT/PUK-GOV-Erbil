"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, Loader2, MoreHorizontal, Palette, Printer, Trash2, UserPlus, UsersRound, Wand2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog, ErrorState, formatDate, TableSkeleton } from "@/components/shared";
import { CvDocument, STANDARD_BLOCKS } from "@/components/cv-document";
import { useCandidateFields, useCandidateSections } from "@/components/candidate-fields";
import { apiClient, Candidate, CandidateAccount, CvDesign } from "@/lib/client";
import { CustomData, sectionLabel } from "@/lib/candidate-fields";
import { useI18n } from "@/lib/i18n";
import { useOrg } from "@/lib/org-context";

function randomPassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint32Array(10);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // clipboard unavailable
        }
      }}
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

/* ----------------------------- Candidate access ---------------------------- */

type Created = { username: string; password: string; code: string };

function AccountDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  useEffect(() => {
    if (!open) return;
    setUsername("");
    setPassword(randomPassword());
    setFullName("");
    setEmail("");
    setError(null);
    setCreated(null);
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const a = await apiClient.createCandidateAccount({ username, password, fullName, email });
      setCreated({ username: a.username, password, code: a.code });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const sheet = created ? `${t("Username")}: ${created.username}\n${t("Password")}: ${created.password}\n${t("Candidate code")}: ${created.code}` : "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{created ? t("Candidate access created") : t("Add candidate access")}</DialogTitle>
          <DialogDescription>
            {created
              ? t("Give these details to the candidate. The password is shown only now.")
              : t("The candidate signs in with this username and password. A unique code is created automatically.")}
          </DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="space-y-3">
            <dl className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              {[
                [t("Username"), created.username],
                [t("Password"), created.password],
                [t("Candidate code"), created.code],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="flex items-center gap-1 font-mono" dir="ltr">
                    {v}
                    <CopyButton text={v} label={t("Copy")} />
                  </dd>
                </div>
              ))}
            </dl>
            <Button type="button" variant="outline" className="w-full" onClick={() => navigator.clipboard?.writeText(sheet).then(() => toast.success("Copied"))}>
              <Copy className="me-2 h-4 w-4" /> {t("Copy all")}
            </Button>
            <DialogFooter>
              <Button type="button" onClick={onClose}>
                {t("Done")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="ca-user">{t("Username")} *</Label>
              <Input id="ca-user" dir="ltr" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ahmed.ali" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ca-pass">{t("Password")} *</Label>
              <div className="flex gap-2">
                <Input id="ca-pass" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
                <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>
                  <Wand2 className="me-1.5 h-4 w-4" /> {t("Generate")}
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ca-name">{t("Candidate name (optional)")}</Label>
                <Input id="ca-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ca-email">{t("Email (optional)")}</Label>
                <Input id="ca-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {t(error)}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("Create")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResetDialog({ account, onClose }: { account: CandidateAccount | null; onClose: () => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (account) {
      setPassword(randomPassword());
      setError(null);
      setDone(false);
    }
  }, [account]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.updateCandidateAccount(account.id, { password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!account} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("Reset password")}</DialogTitle>
          <DialogDescription dir="ltr" className="text-start">
            {account?.username}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="flex items-center gap-1">
            <Input dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" disabled={done} />
            <CopyButton text={password} label={t("Copy")} />
          </div>
          {done && <p className="text-sm text-emerald-700">{t("Password changed. Give the new password to the candidate.")}</p>}
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(error)}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {done ? t("Done") : t("Cancel")}
            </Button>
            {!done && (
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("Reset password")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CandidateAccessSettings() {
  const { t } = useI18n();
  const [rows, setRows] = useState<CandidateAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<CandidateAccount | null>(null);
  const [deleting, setDeleting] = useState<CandidateAccount | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function load() {
    try {
      setRows(await apiClient.listCandidateAccounts());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function remove() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiClient.deleteCandidateAccount(deleting.id);
      toast.success("Candidate access deleted");
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t("Candidate access")}</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("Create a username and password for each candidate. Each one gets a unique code. The candidate signs in from the first page, fills in the application and then sees their CV.")}
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <UserPlus className="me-2 h-4 w-4" />
          {t("Add candidate access")}
        </Button>
      </div>

      <div className="mt-4">
        {error && <ErrorState message={error} onRetry={load} />}
        {!rows && !error && <TableSkeleton rows={3} />}
        {rows && rows.length === 0 && (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {t("No candidate access yet. Click “Add candidate access” to create the first one.")}
          </p>
        )}
        {rows && rows.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" dir="ltr">
                    {a.username}
                    {a.fullName && <span className="ms-2 font-normal text-muted-foreground" dir="auto">{a.fullName}</span>}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground" dir="ltr">
                    <span className="font-mono">{a.code}</span>
                    <CopyButton text={a.code} label={t("Copy")} />
                    · {formatDate(a.createdAt)}
                  </p>
                </div>
                <Badge variant={a.candidateId ? "default" : "secondary"} className="font-normal">
                  {a.candidateId ? t("Submitted") : t("Waiting")}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("Actions for {name}", { name: a.username })}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setResetting(a)}>
                      <KeyRound className="me-2 h-4 w-4" /> {t("Reset password")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleting(a)}>
                      <Trash2 className="me-2 h-4 w-4" /> {t("Delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AccountDialog open={adding} onClose={() => setAdding(false)} onSaved={load} />
      <ResetDialog account={resetting} onClose={() => setResetting(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("Delete access “{name}”?", { name: deleting?.username ?? "" })}
        description={t("The candidate will no longer be able to sign in. Their candidate record is kept.")}
        onConfirm={remove}
        busy={deleteBusy}
      />
    </div>
  );
}

/* -------------------------------- CV design -------------------------------- */

const DEFAULT_DESIGN: CvDesign = {
  layout: "classic",
  accent: "#0369a1",
  font: "sans",
  showCode: true,
  showLogo: true,
  hiddenSections: [],
  headerNote: "",
  footerNote: "",
};

const SAMPLE: Candidate = {
  id: "sample",
  name: "Sara Ahmed",
  email: "sara@example.com",
  phone: "+964 750 000 0000",
  resume: "",
  resumeName: "",
  skills: "",
  experience: "",
  education: "",
  location: "Erbil",
  salary: "",
  noticePeriod: "",
  notes: "Organised and reliable professional with experience leading small teams.",
  tags: "",
  code: "CAND-7K3QX2",
  customData: "{}",
  createdAt: "",
  updatedAt: "",
};

export function CvDesignSettings() {
  const { t, locale } = useI18n();
  const { org } = useOrg();
  const { fields } = useCandidateFields();
  const { sections } = useCandidateSections();
  const [design, setDesign] = useState<CvDesign | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getCvDesign()
      .then(setDesign)
      .catch(() => setDesign(DEFAULT_DESIGN));
  }, []);

  // fill every custom field with sample data so the preview shows the real structure
  const sample = useMemo<Candidate>(() => {
    const data: CustomData = {};
    for (const f of fields ?? []) {
      if (f.type === "number") data[f.id] = 5;
      else if (f.type === "date") data[f.id] = "2024-01-15";
      else if (f.type === "email") data[f.id] = "name@example.com";
      else if (f.type === "phone") data[f.id] = "+964 750 000 0000";
      else if (f.type === "url") data[f.id] = "https://example.com";
      else if (f.type === "yesno") data[f.id] = "yes";
      else if (f.type === "select") data[f.id] = f.options[0] ?? "Option";
      else if (f.type === "multiselect") data[f.id] = f.options.slice(0, 2).length ? f.options.slice(0, 2) : ["Option"];
      else if (f.type !== "file") data[f.id] = "Sample text";
    }
    return { ...SAMPLE, customData: JSON.stringify(data) };
  }, [fields]);

  if (!design) return <TableSkeleton rows={3} />;

  const set = <K extends keyof CvDesign>(k: K, v: CvDesign[K]) => setDesign((d) => (d ? { ...d, [k]: v } : d));
  const hidden = new Set(design.hiddenSections);
  const toggle = (id: string, shown: boolean) => {
    const rest = design.hiddenSections.filter((x) => x !== id);
    set("hiddenSections", shown ? rest : [...rest, id]);
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!design) return;
    setBusy(true);
    setError(null);
    try {
      setDesign(await apiClient.updateCvDesign(design));
      toast.success("CV design saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">{t("CV design")}</h2>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        {t("Design how every candidate CV looks. Candidates see it after they apply, and staff can open it from the candidate profile.")}
      </p>

      <form onSubmit={save} className="mt-4 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("Layout")}</Label>
            <Select value={design.layout} onValueChange={(v) => set("layout", v as CvDesign["layout"])}>
              <SelectTrigger aria-label={t("Layout")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">{t("Classic")}</SelectItem>
                <SelectItem value="modern">{t("Modern (colour header)")}</SelectItem>
                <SelectItem value="sidebar">{t("Sidebar")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("Font")}</Label>
            <Select value={design.font} onValueChange={(v) => set("font", v as CvDesign["font"])}>
              <SelectTrigger aria-label={t("Font")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sans">{t("Sans-serif")}</SelectItem>
                <SelectItem value="serif">{t("Serif")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cv-accent">{t("Accent colour")}</Label>
            <div className="flex items-center gap-2">
              <input
                id="cv-accent"
                type="color"
                value={design.accent}
                onChange={(e) => set("accent", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
              />
              <Input dir="ltr" value={design.accent} onChange={(e) => set("accent", e.target.value)} className="font-mono" maxLength={7} />
            </div>
          </div>
          <div className="space-y-2 sm:col-span-3 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
            <div className="space-y-2">
              <Label htmlFor="cv-head">{t("Line under the name")}</Label>
              <Input id="cv-head" value={design.headerNote} onChange={(e) => set("headerNote", e.target.value)} maxLength={300} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cv-foot">{t("Footer text")}</Label>
              <Input id="cv-foot" value={design.footerNote} onChange={(e) => set("footerNote", e.target.value)} maxLength={300} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={design.showCode} onCheckedChange={(v) => set("showCode", v)} />
            {t("Show the candidate code")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={design.showLogo} onCheckedChange={(v) => set("showLogo", v)} />
            {t("Show the organization logo")}
          </label>
        </div>

        <div className="space-y-2">
          <Label>{t("Sections shown on the CV")}</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {STANDARD_BLOCKS.map((b) => (
              <label key={b.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <Checkbox checked={!hidden.has(b.id)} onCheckedChange={(v) => toggle(b.id, v === true)} />
                {t(b.label)}
              </label>
            ))}
            {(sections ?? []).map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <Checkbox checked={!hidden.has(s.id)} onCheckedChange={(v) => toggle(s.id, v === true)} />
                {sectionLabel(s, locale)}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {t(error)}
          </div>
        )}
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t("Save CV design")}
        </Button>
      </form>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium">{t("Preview")}</p>
        <div className="rounded-lg bg-muted/40 p-3 sm:p-5">
          <CvDocument
            candidate={sample}
            fields={fields ?? []}
            sections={sections ?? []}
            design={design}
            logoUrl={org.logoUrl}
            orgName={org.name}
          />
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Staff: open a candidate's CV ----------------------- */

export function CandidateCvDialog({ candidate, open, onOpenChange }: { candidate: Candidate; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n();
  const { org } = useOrg();
  const { fields } = useCandidateFields();
  const { sections } = useCandidateSections();
  const [design, setDesign] = useState<CvDesign | null>(null);

  useEffect(() => {
    if (!open) return;
    apiClient
      .getCvDesign()
      .then(setDesign)
      .catch(() => setDesign(DEFAULT_DESIGN));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Candidate CV")}</DialogTitle>
          <DialogDescription>{t("Shown with the CV design set in Settings.")}</DialogDescription>
        </DialogHeader>
        {design && fields && sections ? (
          <>
            <div className="flex justify-end print:hidden">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="me-1.5 h-4 w-4" /> {t("Print / Save as PDF")}
              </Button>
            </div>
            <CvDocument candidate={candidate} fields={fields} sections={sections} design={design} logoUrl={org.logoUrl} orgName={org.name} />
          </>
        ) : (
          <TableSkeleton rows={4} />
        )}
      </DialogContent>
    </Dialog>
  );
}
