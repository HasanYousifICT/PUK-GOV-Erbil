// OpenRecruitOS — shared client-side types & typed API client

import type { JobCategory } from "@/lib/categories";
import type { CandidateField, CustomData, FieldType, FileValue } from "@/lib/candidate-fields";
import type { CandidateFilters } from "@/lib/candidate-filters";

export type SessionUser = { id: string; name: string; email: string };

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
  skills: string;
  experience: string;
  education: string;
  location: string;
  salary: string;
  noticePeriod: string;
  notes: string;
  tags: string;
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

export class ApiClientError extends Error {}

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
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore
    }
    throw new ApiClientError(message);
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
  listCandidateFields: () => api<CandidateField[]>("/api/candidate-fields"),
  createCandidateField: (data: {
    label: string;
    labelCkb?: string;
    type: FieldType;
    options?: string[];
    required?: boolean;
  }) => api<CandidateField>("/api/candidate-fields", { method: "POST", body: JSON.stringify(data) }),
  updateCandidateField: (
    id: string,
    data: { label?: string; labelCkb?: string; options?: string[]; required?: boolean }
  ) => api<CandidateField>(`/api/candidate-fields/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCandidateField: (id: string) =>
    api<{ ok: boolean }>(`/api/candidate-fields/${id}`, { method: "DELETE" }),
  reorderCandidateFields: (ids: string[]) =>
    api<{ ok: boolean }>("/api/candidate-fields/reorder", { method: "PUT", body: JSON.stringify({ ids }) }),
  uploadFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api<FileValue & { size: number }>("/api/files", { method: "POST", body: form });
  },

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
