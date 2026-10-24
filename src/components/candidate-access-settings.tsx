"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Eye, EyeOff, KeyRound, Loader2, MoreHorizontal, Palette, Phone, Search, Trash2, UserPlus, UsersRound, Wand2, X } from "lucide-react";
import { toast } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
import { cvFileName, downloadPdfOrPrint } from "@/lib/pdf-export";
import { PasswordInput } from "@/components/password-input";
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
import { ApiClientError, apiClient, Candidate, CandidateAccount, CvDesign, DuplicateAccount, Paged } from "@/lib/client";
import { Pager } from "@/components/pager";
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

/** Shows dots until the admin clicks the eye. */
function MaskedValue({ value }: { value: string }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <>
      <span>{show ? value : "•".repeat(Math.min(value.length, 12))}</span>
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t("Hide password") : t("Show password")} className="rounded p-1 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </>
  );
}

type Created = { username: string | null; phone: string; password: string; code: string };

/** A candidate that already exists (the candidate list's "Create access" button). */
export type AccessFor = { id: string; name: string; email: string; phone: string };

export function AccountDialog({
  open,
  candidate,
  onClose,
  onSaved,
  onOpenDetails,
}: {
  open: boolean;
  candidate?: AccessFor | null;
  onClose: () => void;
  onSaved: () => void;
  onOpenDetails: (id: string) => void;
}) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateAccount | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  useEffect(() => {
    if (!open) return;
    setUsername("");
    setPassword(randomPassword());
    setFullName(candidate?.name ?? "");
    setEmail(candidate?.email ?? "");
    setPhone(candidate?.phone ?? "");
    setError(null);
    setDuplicate(null);
    setCreated(null);
  }, [open, candidate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDuplicate(null);
    if (!phone.trim()) return setError("Phone number is required");
    setBusy(true);
    try {
      const a = await apiClient.createCandidateAccount({
        username: username.trim() || undefined,
        password,
        phone,
        fullName,
        email,
        candidateId: candidate?.id,
      });
      setCreated({ username: a.username, phone: a.phone ?? phone, password, code: a.code });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      if (err instanceof ApiClientError && err.data?.duplicate) setDuplicate(err.data.duplicate as DuplicateAccount);
    } finally {
      setBusy(false);
    }
  }

  const sheet = created
    ? [
        `${t("Phone")}: ${created.phone}`,
        created.username ? `${t("Username")}: ${created.username}` : "",
        `${t("Password")}: ${created.password}`,
        `${t("Candidate code")}: ${created.code}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {created
              ? t("Candidate access created")
              : candidate
                ? t("Create access for {name}", { name: candidate.name })
                : t("Add candidate access")}
          </DialogTitle>
          <DialogDescription>
            {created
              ? t("Give these details to the candidate. The password is shown only now.")
              : t("The candidate signs in with the phone number (or the username, if you set one) and the password. A unique code is created automatically.")}
          </DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="space-y-3">
            <dl className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              {[
                [t("Phone"), created.phone],
                ...(created.username ? [[t("Username"), created.username]] : []),
                [t("Password"), created.password],
                [t("Candidate code"), created.code],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="flex items-center gap-1 font-mono" dir="ltr">
                    {k === t("Password") ? <MaskedValue value={v} /> : v}
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
              <Label htmlFor="ca-phone">{t("Phone")} *</Label>
              <Input id="ca-phone" type="tel" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+964 750 000 0000" />
              <p className="text-xs text-muted-foreground">{t("Each phone number can be used for one candidate access only.")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ca-user">{t("Username (optional)")}</Label>
              <Input id="ca-user" dir="ltr" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ahmed.ali" />
              <p className="text-xs text-muted-foreground">{t("The candidate can sign in with the phone number, or with the username if you set one.")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ca-pass">{t("Password")} *</Label>
              <div className="flex gap-2">
                <PasswordInput id="ca-pass" value={password} onChange={setPassword} className="font-mono" />
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
            {error && !duplicate && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {t(error)}
              </div>
            )}
            {duplicate && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p className="font-semibold">{t("Candidate duplicate")}</p>
                <p className="mt-0.5">{t("This phone number already belongs to another candidate access.")}</p>
                <button
                  type="button"
                  className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 rounded-md bg-white/70 px-2 py-1 text-start font-medium text-red-800 underline underline-offset-2 hover:bg-white"
                  onClick={() => {
                    onClose();
                    onOpenDetails(duplicate.id);
                  }}
                >
                  <span dir="ltr">{duplicate.username ?? duplicate.phone}</span>
                  {duplicate.fullName && <span dir="auto">· {duplicate.fullName}</span>}
                  <span dir="ltr">· {duplicate.phone}</span>
                  <span>— {t("Open details")}</span>
                </button>
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
            {account?.username ?? account?.phone}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="flex items-center gap-1">
            <PasswordInput value={password} onChange={setPassword} className="font-mono" disabled={done} />
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

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children}</dd>
    </div>
  );
}

/** Everything about one candidate access: details, edit name/phone/e-mail, reset password, delete. */
function AccountDetailsDialog({
  account,
  canEdit,
  onClose,
  onChanged,
  onReset,
  onDelete,
  onOpenOther,
}: {
  account: CandidateAccount | null;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
  onReset: (a: CandidateAccount) => void;
  onDelete: (a: CandidateAccount) => void;
  onOpenOther: (id: string) => void;
}) {
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateAccount | null>(null);

  useEffect(() => {
    if (!account) return;
    setUsername(account.username ?? "");
    setFullName(account.fullName);
    setEmail(account.email);
    setPhone(account.phone ?? "");
    setError(null);
    setDuplicate(null);
  }, [account]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!account) return;
    setError(null);
    setDuplicate(null);
    setBusy(true);
    try {
      await apiClient.updateCandidateAccount(account.id, { fullName, email, phone, username });
      toast.success("Saved");
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      if (err instanceof ApiClientError && err.data?.duplicate) setDuplicate(err.data.duplicate as DuplicateAccount);
    } finally {
      setBusy(false);
    }
  }

  const a = account;
  const status = a ? (a.candidateId ? "Submitted" : a.draftAt ? "Draft saved" : "Waiting") : "";
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Candidate access details")}</DialogTitle>
          <DialogDescription dir="ltr" className="text-start">
            {a?.username ?? a?.phone}
          </DialogDescription>
        </DialogHeader>
        {a && (
          <form onSubmit={save} className="space-y-4" noValidate>
            <dl className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
              <Fact label={t("Sign in with")}>
                <span dir="ltr">{[a.phone, a.username].filter(Boolean).join("  ·  ") || "—"}</span>
              </Fact>
              <Fact label={t("Candidate code")}>
                <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                  {a.code}
                  <CopyButton text={a.code} label={t("Copy")} />
                </span>
              </Fact>
              <Fact label={t("Status")}>
                <Badge variant={a.candidateId ? "default" : "secondary"} className="font-normal">
                  {t(status)}
                </Badge>
              </Fact>
              <Fact label={t("Created")}>{formatDate(a.createdAt)}</Fact>
              {a.submittedAt && <Fact label={t("Submitted")}>{formatDate(a.submittedAt)}</Fact>}
              {a.draftAt && !a.candidateId && <Fact label={t("Draft saved")}>{formatDate(a.draftAt)}</Fact>}
            </dl>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cd-name">{t("Candidate name (optional)")}</Label>
                <Input id="cd-name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cd-phone">{t("Phone")} *</Label>
                <Input id="cd-phone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cd-user">{t("Username (optional)")}</Label>
                <Input id="cd-user" dir="ltr" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cd-email">{t("Email (optional)")}</Label>
                <Input id="cd-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canEdit} />
              </div>
            </div>
            {error && !duplicate && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {t(error)}
              </div>
            )}
            {duplicate && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p className="font-semibold">{t("Candidate duplicate")}</p>
                <button
                  type="button"
                  className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 rounded-md bg-white/70 px-2 py-1 text-start font-medium text-red-800 underline underline-offset-2 hover:bg-white"
                  onClick={() => onOpenOther(duplicate.id)}
                >
                  <span dir="ltr">{duplicate.username ?? duplicate.phone}</span>
                  {duplicate.fullName && <span dir="auto">· {duplicate.fullName}</span>}
                  <span dir="ltr">· {duplicate.phone}</span>
                  <span>— {t("Open details")}</span>
                </button>
              </div>
            )}
            <DialogFooter className="gap-2 sm:justify-between">
              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => onReset(a)}>
                    <KeyRound className="me-1.5 h-4 w-4" /> {t("Reset password")}
                  </Button>
                  <Button type="button" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => onDelete(a)}>
                    <Trash2 className="me-1.5 h-4 w-4" /> {t("Delete")}
                  </Button>
                </div>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  {t("Close")}
                </Button>
                {canEdit && (
                  <Button type="submit" disabled={busy}>
                    {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                    {t("Save")}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

type StatusFilter = "all" | "Submitted" | "Waiting" | "Draft saved";

export function CandidateAccessSettings({ canEdit = true, openId }: { canEdit?: boolean; openId?: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<Paged<CandidateAccount> | null>(null);
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState<CandidateAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<CandidateAccount | null>(null);
  const [deleting, setDeleting] = useState<CandidateAccount | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [phoneFilter, setPhoneFilter] = useState<"all" | "with" | "without">("all");

  const PAGE_SIZE = 50;
  const load = useCallback(async () => {
    try {
      setData(await apiClient.listCandidateAccounts({ page, pageSize: PAGE_SIZE, q: search.trim(), status: status === "all" ? "" : status, phone: phoneFilter === "all" ? "" : phoneFilter }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [page, search, status, phoneFilter]);
  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);
  // any change of search / filters goes back to the first page
  useEffect(() => {
    setPage(1);
  }, [search, status, phoneFilter]);
  const rows = data?.items ?? null;
  // arriving from a "Candidate duplicate" link elsewhere: open that access
  useEffect(() => {
    if (openId) setDetailsId(openId);
  }, [openId]);

  const statusOf = (a: CandidateAccount): StatusFilter => (a.candidateId ? "Submitted" : a.draftAt ? "Draft saved" : "Waiting");

  const shown = rows ?? [];
  const filtering = search.trim() !== "" || status !== "all" || phoneFilter !== "all";
  // the open account may not be on the current page (e.g. arriving from a link), so fetch it on its own
  useEffect(() => {
    if (!detailsId) return setOpened(null);
    if (rows?.some((a) => a.id === detailsId)) return;
    apiClient.getCandidateAccount(detailsId).then(setOpened).catch(() => setOpened(null));
  }, [detailsId, rows]);
  const details = rows?.find((a) => a.id === detailsId) ?? (opened?.id === detailsId ? opened : null);

  async function remove() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiClient.deleteCandidateAccount(deleting.id);
      toast.success("Candidate access deleted");
      setDeleting(null);
      setDetailsId(null);
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
            {t("Create a login for each candidate with their phone number (a username is optional) and a password. Each one gets a unique code. The candidate signs in from the first page, fills in the application and then sees their CV.")}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="me-2 h-4 w-4" />
            {t("Add candidate access")}
          </Button>
        )}
      </div>

      {(rows && rows.length > 0 || filtering) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search by name, username, code or phone")}
              aria-label={t("Search by name, username, code or phone")}
              className="ps-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-44" aria-label={t("Status")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All statuses")}</SelectItem>
              <SelectItem value="Submitted">{t("Submitted")}</SelectItem>
              <SelectItem value="Draft saved">{t("Draft saved")}</SelectItem>
              <SelectItem value="Waiting">{t("Waiting")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={phoneFilter} onValueChange={(v) => setPhoneFilter(v as typeof phoneFilter)}>
            <SelectTrigger className="w-44" aria-label={t("Phone")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Any phone")}</SelectItem>
              <SelectItem value="with">{t("Has a phone number")}</SelectItem>
              <SelectItem value="without">{t("No phone number yet")}</SelectItem>
            </SelectContent>
          </Select>
          {filtering && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatus("all");
                setPhoneFilter("all");
              }}
            >
              <X className="me-1 h-4 w-4" /> {t("Clear filters")}
            </Button>
          )}
        </div>
      )}
      {data && data.total > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{t("Showing {n} of {total}", { n: shown.length, total: data.total })}</p>
      )}

      <div className="mt-3">
        {error && <ErrorState message={error} onRetry={load} />}
        {!rows && !error && <TableSkeleton rows={3} />}
        {rows && rows.length === 0 && !filtering && (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {t("No candidate access yet. Click “Add candidate access” to create the first one.")}
          </p>
        )}
        {rows && rows.length === 0 && filtering && (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{t("Nothing matches your search.")}</p>
        )}
        {shown.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {shown.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 hover:bg-muted/30">
                <button type="button" className="min-w-0 flex-1 text-start" onClick={() => setDetailsId(a.id)} aria-label={t("Open details")}>
                  <p className="truncate text-sm font-medium" dir="ltr">
                    {a.username ?? a.phone ?? a.code}
                    {a.fullName && <span className="ms-2 font-normal text-muted-foreground" dir="auto">{a.fullName}</span>}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground" dir="ltr">
                    <span className="font-mono">{a.code}</span>
                    {a.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {a.phone}
                      </span>
                    )}
                    <span>{formatDate(a.createdAt)}</span>
                  </p>
                </button>
                <CopyButton text={a.code} label={t("Copy")} />
                <Badge variant={a.candidateId ? "default" : "secondary"} className="font-normal">
                  {t(statusOf(a))}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("Actions for {name}", { name: a.username ?? a.phone ?? a.code })}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setDetailsId(a.id)}>
                      <UsersRound className="me-2 h-4 w-4" /> {t("Open details")}
                    </DropdownMenuItem>
                    {canEdit && (
                      <>
                        <DropdownMenuItem onClick={() => setResetting(a)}>
                          <KeyRound className="me-2 h-4 w-4" /> {t("Reset password")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleting(a)}>
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
        {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />}
      </div>

      <AccountDialog open={adding} onClose={() => setAdding(false)} onSaved={load} onOpenDetails={setDetailsId} />
      <AccountDetailsDialog
        account={details}
        canEdit={canEdit}
        onClose={() => setDetailsId(null)}
        onChanged={load}
        onReset={(a) => {
          setDetailsId(null);
          setResetting(a);
        }}
        onDelete={(a) => {
          setDetailsId(null);
          setDeleting(a);
        }}
        onOpenOther={setDetailsId}
      />
      <ResetDialog account={resetting} onClose={() => setResetting(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("Delete access “{name}”?", { name: deleting?.username ?? deleting?.phone ?? "" })}
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
  photo: "",
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
              <Button
                size="sm"
                onClick={async () => {
                  const ok = await downloadPdfOrPrint(document.getElementById("cv-admin-root"), cvFileName({ name: candidate.name, code: candidate.code, phone: candidate.phone }));
                  if (ok) toast.success("Your CV has been downloaded");
                }}
              >
                <Download className="me-1.5 h-4 w-4" /> {t("Download PDF")}
              </Button>
            </div>
            <div id="cv-admin-root">
              <CvDocument candidate={candidate} fields={fields} sections={sections} design={design} logoUrl={org.logoUrl} orgName={org.name} />
            </div>
          </>
        ) : (
          <TableSkeleton rows={4} />
        )}
      </DialogContent>
    </Dialog>
  );
}
