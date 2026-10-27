"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { FileText, Loader2, ScanSearch, Trash2, Upload, X } from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Candidate, ParseResumeResult, apiClient } from "@/lib/client";
import { CustomFieldInput, useCandidateFields, useCandidateSections } from "@/components/candidate-fields";
import { PhotoPicker } from "@/components/photo-picker";
import { CustomData, fieldLabel, groupFields, isFieldVisible, isEmptyValue, isPersonalSection, parseCustomData, sectionLabel } from "@/lib/candidate-fields";

import { useI18n } from "@/lib/i18n";
const BLANK = {
  name: "",
  email: "",
  phone: "",
  skills: "",
  experience: "",
  education: "",
  location: "",
  salary: "",
  noticePeriod: "",
  notes: "",
  tags: "",
};

export type CandidateFormValues = typeof BLANK & { resume: string; resumeName: string; photo: string };

export function CandidateFormDialog({
  open,
  onOpenChange,
  candidate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate?: Candidate | null;
  onSaved: () => void;
}) {
  const { t, locale } = useI18n();
  const { fields } = useCandidateFields();
  const { sections } = useCandidateSections();
  const [custom, setCustom] = useState<CustomData>({});
  const [form, setForm] = useState<CandidateFormValues>({ ...BLANK, resume: "", resumeName: "", photo: "" });
  const [uploading, setUploading] = useState(false);
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setParseNote(null);
      setCustom(parseCustomData(candidate?.customData));
      setForm({
        ...BLANK,
        name: candidate?.name ?? "",
        email: candidate?.email ?? "",
        phone: candidate?.phone ?? "",
        skills: candidate?.skills ?? "",
        experience: candidate?.experience ?? "",
        education: candidate?.education ?? "",
        location: candidate?.location ?? "",
        salary: candidate?.salary ?? "",
        noticePeriod: candidate?.noticePeriod ?? "",
        notes: candidate?.notes ?? "",
        tags: candidate?.tags ?? "",
        resume: candidate?.resume ?? "",
        resumeName: candidate?.resumeName ?? "",
        photo: candidate?.photo ?? "",
      });
    }
  }, [open, candidate]);

  const set = (key: keyof CandidateFormValues) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleFile(file: File) {
    setError(null);
    setParseNote(null);
    setUploading(true);
    try {
      const result: ParseResumeResult = await apiClient.parseResume(file);
      // Pre-populate only fields the parser actually found — recruiter reviews & edits before save
      setForm((f) => ({
        ...f,
        name: result.parsed.name || f.name,
        email: result.parsed.email || f.email,
        phone: result.parsed.phone || f.phone,
        resume: result.resume,
        resumeName: result.resumeName,
      }));
      if (result.parseError) {
        setParseNote(result.parseError);
      } else {
        setParseNote("Details extracted from the resume. Please review and edit before saving.");
        toast.success("Resume parsed — review the extracted details");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeResume() {
    setForm((f) => ({ ...f, resume: "", resumeName: "" }));
    setParseNote(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Candidate name is required");
      return;
    }
    setBusy(true);
    const payload = { ...form, customData: custom };
    try {
      if (candidate) {
        await apiClient.updateCandidate(candidate.id, payload);
        toast.success("Candidate updated");
      } else {
        await apiClient.createCandidate(payload);
        toast.success("Candidate added");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto thin-scrollbar sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{candidate ? t("Edit Candidate") : t("Add Candidate")}</DialogTitle>
          <DialogDescription>
            {t("Upload a resume to auto-fill the profile, or enter details manually. Everything is editable before saving.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Resume upload */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium">{t("Resume (PDF, DOC, DOCX · max 10 MB)")}</Label>
              {form.resume && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-red-600 hover:text-red-600"
                  onClick={removeResume}
                >
                  <X className="me-1 h-3.5 w-3.5" /> {t("Remove")}
                </Button>
              )}
            </div>

            {form.resume ? (
              <div className="mt-2 flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{form.resumeName || "Resume.pdf"}</p>
                  <p className="text-xs text-muted-foreground">
                    {candidate?.resume === form.resume ? t("Current resume") : t("Stored — will be attached on save")}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="me-1.5 h-3.5 w-3.5" /> {t("Replace")}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className={`mt-2 flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
                  dragOver ? "border-sky-500 bg-sky-50" : "border-border bg-card hover:bg-muted/50"
                }`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFile(file);
                }}
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">
                  {uploading ? t("Uploading & parsing…") : t("Click to upload or drag & drop")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("Basic parsing fills name, email and phone")}
                </span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              aria-label={t("Upload resume file")}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />

            {parseNote && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <ScanSearch className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t(parseNote)}
              </p>
            )}
          </div>

          {/* Personal information: built-in fields first, then any custom fields of that section */}
          {(() => {
            const groups = fields && sections
              ? groupFields(fields, sections).map((g) => ({ ...g, fields: g.fields.filter((f) => isFieldVisible(f, custom, fields)) })).filter((g) => g.fields.length > 0)
              : [];
            const personal = groups.find((g) => isPersonalSection(g.section));
            const others = groups.filter((g) => g !== personal);
            const renderCustom = (group: typeof groups[number]["fields"]) =>
              group.map((f) => (
                <div key={f.id} className={f.type === "file" || f.type === "table" || f.type === "longtext" ? "sm:col-span-2" : ""}>
                  <CustomFieldInput
                    field={f}
                    answers={custom}
                    showRequired={false}
                    value={custom[f.id]}
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
                      <PhotoPicker value={form.photo} upload={(f) => apiClient.uploadFile(f, "photo")} onChange={(k) => setForm((x) => ({ ...x, photo: k }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cand-name">{t("Full Name *")}</Label>
                      <Input id="cand-name" value={form.name} onChange={(e) => set("name")(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cand-email">{t("Email")}</Label>
                      <Input id="cand-email" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cand-phone">{t("Phone")}</Label>
                      <Input id="cand-phone" value={form.phone} onChange={(e) => set("phone")(e.target.value)} />
                    </div>
                    {!(fields ?? []).some((f) => f.settings.toLocation) && (
                      <div className="space-y-2">
                        <Label htmlFor="cand-location">{t("Location")}</Label>
                        <Input id="cand-location" value={form.location} onChange={(e) => set("location")(e.target.value)} />
                      </div>
                    )}
                    {personal && renderCustom(personal.fields)}
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="cand-tags">{t("Tags (comma-separated)")}</Label>
                      <Input id="cand-tags" placeholder={t("referral, frontend, priority")} value={form.tags} onChange={(e) => set("tags")(e.target.value)} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="cand-notes">{t("Notes")}</Label>
                      <Textarea id="cand-notes" rows={3} placeholder={t("Recruiter notes…")} value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
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

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(error)}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={busy || uploading}>
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {candidate ? t("Save changes") : t("Add candidate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
