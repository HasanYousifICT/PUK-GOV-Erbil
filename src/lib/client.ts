// OpenRecruitOS — shared client-side types & typed API client

import type { JobCategory } from "@/lib/categories";
import type { CandidateField, CandidateSection, CustomData, FieldType, FileValue, ShowIf } from "@/lib/candidate-fields";
import type { CandidateFilters } from "@/lib/candidate-filters";

import type { Permissions } from "@/lib/permissions";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "recruiter";
  phone: string;
  title: string;
  permissions: Permissions;
};

export type ManagedUser = SessionUser & { active: boolean; lastLoginAt: string | null; createdAt: string };

export type Org = {
  name: string;
  tagline: string;
  byline: string;
  company: string;
  website: string;
  websiteUrl: string;
  footer: string;
  logoUrl: string;
  customLogo: boolean;
};

export type CandidateAccount = {
  id: string;
  username: string;
  code: string;
  fullName: string;
  email: string;
  phone: string | null;
  candidateId: string | null;
  submittedAt: string | null;
  draftAt: string | null;
  createdAt: string;
};

/** The half-filled application a candidate saved. */
export type PortalDraft = {
  name: string;
  email: string;
  phone: string;
  location: string;
  notes: string;
  jobId: string;
  resume: string;
  resumeName: string;
  photo: string;
  customData: CustomData;
};

export type CvDesign = {
  layout: "classic" | "modern" | "sidebar";
  accent: string;
  font: "sans" | "serif";
  showCode: boolean;
  showLogo: boolean;
  hiddenSections: string[];
  headerNote: string;
  footerNote: string;
};

export type PortalJob = { id: string; title: string; location: string; employmentType: string };

export type PortalData = {
  account: { username: string; code: string; fullName: string; email: string; phone: string; draftAt: string | null };
  draft: PortalDraft | null;
  submitted: boolean;
  candidate: Candidate | null;
  jobs: PortalJob[];
  fields: CandidateField[];
  sections: CandidateSection[];
  design: CvDesign;
};

export type AuthStatus = { users: number; firstRun: boolean; signupOpen: boolean; demo: boolean };

export type Job = {
  id: string;
  title: string;
  description: string;
  skills: string;
  experience: string;
  location: string;
  salary: string;
  employmentType: string;
  status: "Open" | "Closed";
  categoryId?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { applications: number };
};

export type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  resume: string;
  resumeName: string;
  photo: string; // storage key of the personal photo
  skills: string;
  experience: string;
  education: string;
  location: string;
  salary: string;
  noticePeriod: string;
  notes: string;
  tags: string;
  code?: string | null; // candidate access code
  customData: string; // JSON map of custom field id -> value (see parseCustomData)
  createdAt: string;
  updatedAt: string;
  _count?: { applications: number };
};

/** Body for creating/updating a candidate: customData is sent as an object. */
export type CandidatePayload = Partial<Omit<Candidate, "customData">> & { customData?: CustomData };

export type BulkAddResult = { created: number; skipped: number; missing: number; jobTitle: string };

export type ApplicationHistoryEntry = {
  id: string;
  applicationId: string;
  previousStage: string;
  newStage: string;
  changedAt: string;
};

export type Interview = {
  id: string;
  applicationId: string;
  interviewer: string;
  date: string;
  time: string;
  status: "Scheduled" | "Completed" | "Cancelled";
  feedback: string;
  createdAt: string;
  updatedAt: string;
  application?: {
    id: string;
    stage: string;
    candidate: { id: string; name: string; email: string };
    job: { id: string; title: string; location: string };
  };
};

export type Application = {
  id: string;
  candidateId: string;
  jobId: string;
  stage: string;
  status: "Active" | "Hired" | "Rejected";
  appliedAt: string;
  updatedAt: string;
  candidate?: Pick<Candidate, "id" | "name" | "email" | "phone" | "skills" | "experience" | "location" | "resume" | "resumeName">;
  job?: Pick<Job, "id" | "title" | "location" | "employmentType" | "status">;
  history?: ApplicationHistoryEntry[];
  interviews?: Interview[];
  _count?: { applications: number };
};

export type JobDetail = Job & {
  applications: (Application & {
    candidate: Pick<Candidate, "id" | "name" | "email" | "phone" | "skills" | "experience" | "location">;
    interviews: Interview[];
  })[];
};

export type CandidateDetail = Candidate & {
  applications: (Application & {
    job: Pick<Job, "id" | "title" | "location" | "status" | "employmentType">;
    history: ApplicationHistoryEntry[];
    interviews: Interview[];
  })[];
};

export type DashboardData = {
  stats: {
    openJobs: number;
    totalJobs: number;
    totalCandidates: number;
    totalApplications: number;
    upcomingInterviews: number;
    totalInterviews: number;
    hires: number;
    rejected: number;
  };
  trends: {
    applicationsByDay: { date: string; count: number }[];
    applications7d: number;
    applicationsPrev7d: number;
    candidates7d: number;
    candidatesPrev7d: number;
  };
  upcoming: { id: string; date: string; time: string; interviewer: string; candidateId: string; candidate: string; job: string }[];
  topJobs: { id: string; title: string; location: string; applications: number }[];
  portal: { total: number; submitted: number };
  pipelineStages: string[];
  pipeline: Record<string, number>;
  recentActivity: {
    id: string;
    candidate: string;
    job: string;
    previousStage: string;
    newStage: string;
    changedAt: string;
  }[];
};

export type ParsedResume = {
  name: string;
  email: string;
  phone: string;
  skills: string;
  experience: string;
  education: string;
};

export type ParseResumeResult = {
  resume: string;
  resumeName: string;
  parsed: ParsedResume;
  parseError: string | null;
};

/* ------------------------------- API client ------------------------------- */

export class ApiClientError extends Error {
  /** Extra data sent with the error (for example `duplicate` for a repeated phone number). */
  constructor(message: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

export type DuplicateAccount = { id: string; username: string; fullName: string; phone: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers:
      init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json", ...init?.headers }
        : init?.headers,
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let extra: Record<string, unknown> | undefined;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
      extra = data;
    } catch {
      // ignore
    }
    throw new ApiClientError(message, extra);
  }
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export const apiClient = {
  /* auth */
  login: (email: string, password: string) =>
    api<SessionUser>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) =>
    api<SessionUser>("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }),
  authStatus: () => api<AuthStatus>("/api/auth/status"),
  logout: () => api<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => api<SessionUser>("/api/auth/me"),
  updateProfile: (name: string) =>
    api<SessionUser>("/api/auth/me", { method: "PUT", body: JSON.stringify({ name }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ ok: boolean }>("/api/auth/password", { method: "PUT", body: JSON.stringify({ currentPassword, newPassword }) }),

  /* jobs */
  listJobs: (status?: string) => api<Job[]>(`/api/jobs${qs({ status })}`),
  getJob: (id: string) => api<JobDetail>(`/api/jobs/${id}`),
  createJob: (data: Partial<Job>) => api<Job>("/api/jobs", { method: "POST", body: JSON.stringify(data) }),
  updateJob: (id: string, data: Partial<Job>) =>
    api<Job>(`/api/jobs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteJob: (id: string) => api<{ ok: boolean }>(`/api/jobs/${id}`, { method: "DELETE" }),

  /* job classification */
  listCategories: () => api<JobCategory[]>("/api/categories"),
  createCategory: (data: { name: string; code?: string; nameCkb?: string; parentId?: string | null }) =>
    api<JobCategory>("/api/categories", { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id: string, data: { name?: string; code?: string; nameCkb?: string }) =>
    api<JobCategory>(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCategory: (id: string) => api<{ ok: boolean }>(`/api/categories/${id}`, { method: "DELETE" }),
  importCategories: (csv: string) =>
    api<{ created: number; skipped: number; failed: number }>("/api/categories/import", {
      method: "POST",
      body: JSON.stringify({ csv }),
    }),

  /* candidates */
  listCandidates: (q?: string, filters?: CandidateFilters) =>
    api<Candidate[]>(
      `/api/candidates${qs({ q, filters: filters && Object.keys(filters).length ? JSON.stringify(filters) : undefined })}`
    ),
  getCandidate: (id: string) => api<CandidateDetail>(`/api/candidates/${id}`),
  createCandidate: (data: CandidatePayload) =>
    api<Candidate>("/api/candidates", { method: "POST", body: JSON.stringify(data) }),
  updateCandidate: (id: string, data: CandidatePayload) =>
    api<Candidate>(`/api/candidates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCandidate: (id: string) => api<{ ok: boolean }>(`/api/candidates/${id}`, { method: "DELETE" }),
  parseResume: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api<ParseResumeResult>("/api/candidates/parse-resume", { method: "POST", body: form });
  },
  resumeUrl: (key: string) => `/api/resumes?key=${encodeURIComponent(key)}`,

  /* custom candidate fields */
  listCandidateSections: () => api<CandidateSection[]>("/api/candidate-sections"),
  createCandidateSection: (data: { name: string; nameCkb?: string }) =>
    api<CandidateSection>("/api/candidate-sections", { method: "POST", body: JSON.stringify(data) }),
  updateCandidateSection: (id: string, data: { name?: string; nameCkb?: string }) =>
    api<CandidateSection>(`/api/candidate-sections/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCandidateSection: (id: string) => api<{ ok: boolean }>(`/api/candidate-sections/${id}`, { method: "DELETE" }),
  reorderCandidateSections: (ids: string[]) =>
    api<{ ok: boolean }>("/api/candidate-sections/reorder", { method: "PUT", body: JSON.stringify({ ids }) }),
  listCandidateFields: () => api<CandidateField[]>("/api/candidate-fields"),
  createCandidateField: (data: {
    label: string;
    labelCkb?: string;
    type: FieldType;
    options?: string[];
    required?: boolean;
    publicForm?: boolean;
    sectionId?: string;
    showIf?: ShowIf | null;
  }) => api<CandidateField>("/api/candidate-fields", { method: "POST", body: JSON.stringify(data) }),
  updateCandidateField: (
    id: string,
    data: { label?: string; labelCkb?: string; options?: string[]; required?: boolean; publicForm?: boolean; sectionId?: string; showIf?: ShowIf | null }
  ) => api<CandidateField>(`/api/candidate-fields/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCandidateField: (id: string) =>
    api<{ ok: boolean }>(`/api/candidate-fields/${id}`, { method: "DELETE" }),
  reorderCandidateFields: (ids: string[]) =>
    api<{ ok: boolean }>("/api/candidate-fields/reorder", { method: "PUT", body: JSON.stringify({ ids }) }),
  importBoardPreset: () =>
    api<{ sections: number; fields: number; skipped: number; removedSections: number }>("/api/candidate-fields/preset", { method: "POST" }),
  uploadFile: (file: File, kind?: "photo") => {
    const form = new FormData();
    form.append("file", file);
    if (kind) form.append("kind", kind);
    return api<FileValue & { size: number }>("/api/files", { method: "POST", body: form });
  },

  /* organization (branding) */
  getOrg: () => api<Org>("/api/public/org"),
  updateOrg: (data: Omit<Org, "logoUrl" | "customLogo">) =>
    api<Org>("/api/organization", { method: "PUT", body: JSON.stringify(data) }),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api<Org>("/api/organization/logo", { method: "POST", body: form });
  },
  removeLogo: () => api<Org>("/api/organization/logo", { method: "DELETE" }),

  /* users (administrators) */
  listUsers: () => api<ManagedUser[]>("/api/users"),
  createUser: (data: {
    name: string;
    email: string;
    phone: string;
    title?: string;
    password: string;
    role: "admin" | "recruiter";
    permissions?: Permissions;
  }) => api<ManagedUser>("/api/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (
    id: string,
    data: {
      name?: string;
      phone?: string;
      title?: string;
      role?: "admin" | "recruiter";
      permissions?: Permissions;
      active?: boolean;
      password?: string;
    }
  ) =>
    api<ManagedUser>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (id: string) => api<{ ok: boolean }>(`/api/users/${id}`, { method: "DELETE" }),

  /* candidate accounts (administrators) */
  listCandidateAccounts: () => api<CandidateAccount[]>("/api/candidate-accounts"),
  getCandidateAccount: (id: string) => api<CandidateAccount>(`/api/candidate-accounts/${id}`),
  createCandidateAccount: (data: { username: string; password: string; phone: string; fullName?: string; email?: string }) =>
    api<CandidateAccount>("/api/candidate-accounts", { method: "POST", body: JSON.stringify(data) }),
  updateCandidateAccount: (id: string, data: { password?: string; fullName?: string; email?: string; phone?: string }) =>
    api<CandidateAccount>(`/api/candidate-accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCandidateAccount: (id: string) => api<{ ok: boolean }>(`/api/candidate-accounts/${id}`, { method: "DELETE" }),

  /* CV design */
  getCvDesign: () => api<CvDesign>("/api/cv-design"),
  updateCvDesign: (data: CvDesign) => api<CvDesign>("/api/cv-design", { method: "PUT", body: JSON.stringify(data) }),

  /* candidate portal */
  candidateLogin: (username: string, password: string) =>
    api<{ ok: boolean }>("/api/candidate/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  candidateLogout: () => api<{ ok: boolean }>("/api/candidate/logout", { method: "POST" }),
  candidatePortal: () => api<PortalData>("/api/candidate/portal"),
  candidateSaveDraft: (data: Record<string, unknown>) =>
    api<{ ok: boolean; savedAt: string }>("/api/candidate/draft", { method: "PUT", body: JSON.stringify(data) }),
  candidateUpdateProfile: (data: Record<string, unknown>) =>
    api<{ ok: boolean; candidate: Candidate }>("/api/candidate/profile", { method: "PUT", body: JSON.stringify(data) }),
  candidateUpload: (file: File, kind: "resume" | "attachment" | "photo") => {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    return api<{ key: string; name: string; parsed?: ParsedResume }>("/api/candidate/upload", { method: "POST", body: form });
  },
  candidateApply: (data: Record<string, unknown>) =>
    api<{ ok: boolean; candidate: Candidate }>("/api/candidate/apply", { method: "POST", body: JSON.stringify(data) }),

  /* public (no login) */
  publicForm: () =>
    api<{ jobs: { id: string; title: string; location: string; employmentType: string }[]; fields: CandidateField[]; sections: CandidateSection[] }>(
      "/api/public/form"
    ),
  publicUpload: (file: File, kind: "resume" | "attachment" | "photo") => {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    return api<{ key: string; name: string; parsed?: ParsedResume }>("/api/public/upload", { method: "POST", body: form });
  },
  publicApply: (data: Record<string, unknown>) =>
    api<{ ok: boolean }>("/api/public/apply", { method: "POST", body: JSON.stringify(data) }),

  /* applications */
  listApplications: (filters?: { jobId?: string; candidateId?: string; stage?: string }) =>
    api<Application[]>(`/api/applications${qs({ ...filters })}`),
  bulkAddToJob: (candidateIds: string[], jobId: string) =>
    api<BulkAddResult>("/api/applications/bulk", { method: "POST", body: JSON.stringify({ candidateIds, jobId }) }),
  createApplication: (candidateId: string, jobId: string) =>
    api<Application>("/api/applications", { method: "POST", body: JSON.stringify({ candidateId, jobId }) }),
  moveApplication: (id: string, stage: string) =>
    api<Application>(`/api/applications/${id}`, { method: "PUT", body: JSON.stringify({ stage }) }),
  deleteApplication: (id: string) => api<{ ok: boolean }>(`/api/applications/${id}`, { method: "DELETE" }),

  /* interviews */
  listInterviews: (status?: string) => api<Interview[]>(`/api/interviews${qs({ status })}`),
  createInterview: (data: { applicationId: string; interviewer: string; date: string; time: string; feedback?: string }) =>
    api<Interview>("/api/interviews", { method: "POST", body: JSON.stringify(data) }),
  updateInterview: (id: string, data: Partial<{ interviewer: string; date: string; time: string; status: string; feedback: string }>) =>
    api<Interview>(`/api/interviews/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteInterview: (id: string) => api<{ ok: boolean }>(`/api/interviews/${id}`, { method: "DELETE" }),

  /* dashboard */
  dashboard: () => api<DashboardData>("/api/dashboard"),
};
