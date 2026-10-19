"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, FileText, Loader2, Save, Upload, X } from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldInput } from "@/components/candidate-fields";
import { PhotoPicker } from "@/components/photo-picker";
import { apiClient, Candidate, PortalData } from "@/lib/client";
import { CandidateField, CandidateSection, CustomData, fieldLabel, groupFields, isEmptyValue, isFieldVisible, isPersonalSection, parseCustomData, sectionLabel } from "@/lib/candidate-fields";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";

type PublicJob = { id: string; title: string; location: string; employmentType: string };
const NO_JOB = "__none__";

const BLANK = {
  name: "",
  email: "",
  phone: "",
  location: "",
  skills: "",
  experience: "",
  education: "",
  salary: "",
  noticePeriod: "",
  notes: "",
  website: "", // honeypot
};

/**
 * Application form. Public by default; in portal mode (a candidate signed in with the username
 * and code an administrator gave them) it shows their unique code, read-only, and submits once.
 */
export function ApplyView({
  onBack,
  backLabel,
  portal,
}: {
  onBack: () => void;
  backLabel?: string;
  /** `existing`: the candidate already submitted and is now completing/correcting the profile. */
  portal?: { data: PortalData; existing?: Candidate | null; onSubmitted: (c: Candidate) => void; onCancel?: () => void };
}) {
  const { t, locale } = useI18n();
  const [jobs, setJobs] = useState<PublicJob[]>(portal?.data.jobs ?? []);
  const [fields, setFields] = useState<CandidateField[]>(portal?.data.fields ?? []);
  const [sections, setSections] = useState<CandidateSection[]>(portal?.data.sections ?? []);
  const [loading, setLoading] = useState(!portal);
  const existing = portal?.existing ?? null;
  const draft = !existing ? portal?.data.draft ?? null : null;
  const [form, setForm] = useState(() => {
    if (!portal) return BLANK;
    if (existing) return { ...BLANK, name: existing.name, email: existing.email, phone: existing.phone, location: existing.location, notes: existing.notes };
    if (draft) return { ...BLANK, name: draft.name, email: draft.email, phone: draft.phone, location: draft.location, notes: draft.notes };
    const a = portal.data.account;
    return { ...BLANK, name: a.fullName, email: a.email, phone: a.phone };
  });
  const [jobId, setJobId] = useState(draft?.jobId || NO_JOB);
  const [custom, setCustom] = useState<CustomData>(() => (existing ? parseCustomData(existing.customData) : draft?.customData ?? {}));
  const [resume, setResume] = useState<{ key: string; name: string } | null>(() => {
    if (existing?.resume) return { key: existing.resume, name: existing.resumeName };
    if (draft?.resume) return { key: draft.resume, name: draft.resumeName };
    return null;
  });
  const [photo, setPhoto] = useState(existing?.photo ?? draft?.photo ?? "");
  const [savedAt, setSavedAt] = useState<string | null>(portal?.data.account.draftAt ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (portal) return;
    apiClient
      .publicForm()
      .then((d) => {
        setJobs(d.jobs);
        setFields(d.fields);
        setSections(d.sections);
        const wanted = new URLSearchParams(window.location.search).get("job");
        if (wanted && d.jobs.some((j) => j.id === wanted)) setJobId(wanted);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load the form"))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof typeof BLANK) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function pickResume(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const r = portal ? await apiClient.candidateUpload(file, "resume") : await apiClient.publicUpload(file, "resume");
      setResume({ key: r.key, name: r.name });
      const p = r.parsed;
      if (p) {
        // pre-fill only empty fields; the applicant reviews before sending
        setForm((f) => ({
          ...f,
          name: f.name || p.name,
          email: f.email || p.email,
          phone: f.phone || p.phone,
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const payloadNow = () => ({
    ...form,
    jobId: jobId === NO_JOB ? "" : jobId,
    resume: resume?.key ?? "",
    resumeName: resume?.name ?? "",
    photo,
    customData: custom,
  });

  /** Save what has been filled in so far; the candidate can come back and finish later. */
  async function saveDraft() {
    setError(null);
    setSaving(true);
    try {
      const r = await apiClient.candidateSaveDraft(payloadNow());
      setSavedAt(r.savedAt);
      toast.success("Your progress is saved. You can come back and finish later.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.name.trim().length < 2) return setError("Please enter your full name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Please enter a valid email address");
    for (const f of fields) {
      if (f.required && isFieldVisible(f, custom, fields) && isEmptyValue(custom[f.id])) {
        return setError(t("“{name}” is required", { name: fieldLabel(f, locale) }));
      }
    }
    setBusy(true);
    try {
      const payload = payloadNow();
      if (portal) {
        const r = existing ? await apiClient.candidateUpdateProfile(payload) : await apiClient.candidateApply(payload);
        window.scrollTo({ top: 0 });
        portal.onSubmitted(r.candidate);
        return;
      }
      await apiClient.publicApply(payload);
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const shell = (children: ReactNode) => (
    <div className="relative min-h-screen bg-gradient-to-b from-sky-100/40 via-background to-background px-4 py-10">
      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </div>
  );

  if (done) {
    return shell(
      <div className="mt-16 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold">{t("Thank you!")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("Your application has been received. Our team will contact you if your profile matches.")}
        </p>
        <Button className="mt-6" variant="outline" onClick={onBack}>
          {t("Back to home")}
        </Button>
      </div>
    );
  }

  return shell(
    <>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {backLabel ?? t("Back")}
      </button>
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{existing ? t("Edit my profile") : t("Candidate application")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("Upload your CV to fill the form automatically, or enter your details manually.")}
        </p>

        {loading ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
            {portal && (
              <div className="space-y-2 rounded-xl border bg-primary/5 p-4">
                <Label htmlFor="a-code">{t("Your candidate code")}</Label>
                <Input
                  id="a-code"
                  value={portal.data.account.code}
                  readOnly
                  dir="ltr"
                  className="bg-muted font-mono text-base font-semibold tracking-wider"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <p className="text-xs text-muted-foreground">
                  {t("This code is unique to you and cannot be changed. Keep it for any contact with us.")}
                </p>
              </div>
            )}
            {jobs.length > 0 && !existing && (
              <div className="space-y-2">
                <Label>{t("Position")}</Label>
                <Select value={jobId} onValueChange={setJobId}>
                  <SelectTrigger aria-label={t("Position")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={NO_JOB}>{t("General application (no specific job)")}</SelectItem>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title}
                        {j.location ? ` — ${j.location}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* CV */}
            <div className="rounded-xl border bg-muted/30 p-4">
              <Label className="text-sm font-medium">{t("CV / Resume (PDF, DOC, DOCX · max 8 MB)")}</Label>
              {resume ? (
                <div className="mt-2 flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
                  <FileText className="h-5 w-5 shrink-0 text-primary" />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium" dir="auto">
                    {resume.name}
                  </p>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={t("Remove")} onClick={() => setResume(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full justify-start gap-2"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? t("Uploading & parsing…") : t("Choose file")}
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                aria-label={t("Upload resume file")}
                onChange={(e) => pickResume(e.target.files?.[0])}
              />
            </div>

            {(() => {
              const groups = groupFields(fields, sections).map((g) => ({ ...g, fields: g.fields.filter((f) => isFieldVisible(f, custom, fields)) })).filter((g) => g.fields.length > 0);
              const personal = groups.find((g) => isPersonalSection(g.section));
              const others = groups.filter((g) => g !== personal);
              const renderCustom = (group: typeof groups[number]["fields"]) =>
                group.map((f) => (
                  <div key={f.id} className={f.type === "file" || f.type === "table" || f.type === "longtext" ? "sm:col-span-2" : ""}>
                    <CustomFieldInput
                      field={f}
                      value={custom[f.id]}
                      upload={(file) => (portal ? apiClient.candidateUpload(file, "attachment") : apiClient.publicUpload(file, "attachment"))}
                      onChange={(v) =>
                        setCustom((c) => {
                          const n = { ...c };
                          if (v === undefined) delete n[f.id];
                          else n[f.id] = v;
                          return n;
                        })
                      }
                    />
                  </div>
                ));
              return (
                <>
                  <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                    <p className="text-sm font-medium">{t("Personal information")}</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <PhotoPicker
                          value={photo}
                          upload={(f) => (portal ? apiClient.candidateUpload(f, "photo") : apiClient.publicUpload(f, "photo"))}
                          onChange={setPhoto}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="a-name">{t("Full Name *")}</Label>
                        <Input id="a-name" value={form.name} onChange={(e) => set("name")(e.target.value)} autoComplete="name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="a-email">{t("Email *")}</Label>
                        <Input id="a-email" type="email" dir="ltr" value={form.email} onChange={(e) => set("email")(e.target.value)} autoComplete="email" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="a-phone">{t("Phone")}</Label>
                        <Input id="a-phone" dir="ltr" value={form.phone} onChange={(e) => set("phone")(e.target.value)} autoComplete="tel" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="a-loc">{t("Location")}</Label>
                        <Input id="a-loc" value={form.location} onChange={(e) => set("location")(e.target.value)} />
                      </div>
                      {personal && renderCustom(personal.fields)}
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="a-notes">{t("Anything else you'd like us to know")}</Label>
                        <Textarea id="a-notes" rows={3} value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  {others.map(({ section, fields: group }) => (
                    <div key={section.id} className="space-y-3 rounded-xl border bg-muted/20 p-4">
                      <p className="text-sm font-medium">{sectionLabel(section, locale)}</p>
                      <div className="grid gap-4 sm:grid-cols-2">{renderCustom(group)}</div>
                    </div>
                  ))}
                </>
              );
            })()}

            {/* honeypot: hidden from people, bots fill it */}
            <div className="absolute -start-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website")(e.target.value)} />
              </label>
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {t(error)}
              </div>
            )}

            {portal && !existing && (
              <div className="rounded-xl border border-dashed bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  {t("Not ready yet? Save what you have filled in and finish later. Nothing is sent to us until you press “Submit application”.")}
                </p>
                <Button type="button" variant="outline" className="mt-2" onClick={saveDraft} disabled={saving || busy || uploading}>
                  {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                  {t("Save progress")}
                </Button>
                {savedAt && <p className="mt-1.5 text-xs text-emerald-700">{t("Last saved")}: {new Date(savedAt).toLocaleString(locale === "ckb" ? "ckb" : undefined)}</p>}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              {existing && portal?.onCancel && (
                <Button type="button" size="lg" variant="outline" className="sm:w-40" onClick={portal.onCancel} disabled={busy}>
                  {t("Cancel")}
                </Button>
              )}
              <Button type="submit" size="lg" className="flex-1" disabled={busy || uploading}>
                {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {existing ? t("Save changes") : t("Submit application")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
