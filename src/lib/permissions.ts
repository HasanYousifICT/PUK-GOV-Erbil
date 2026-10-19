// Staff permissions. Every area has a level: none (hidden), view (read only) or edit (create/change/delete).
// Administrators always have everything, plus users and settings.

export const AREAS = ["candidates", "jobs", "applications", "interviews", "classification", "access"] as const;
export type Area = (typeof AREAS)[number];
export type Level = "none" | "view" | "edit";
export type Permissions = Record<Area, Level>;

export const AREA_INFO: Record<Area, { label: string; hint: string }> = {
  candidates: { label: "Candidates", hint: "Candidate profiles and their CVs" },
  jobs: { label: "Jobs", hint: "Open positions" },
  applications: { label: "Applications", hint: "Moving candidates through the stages" },
  interviews: { label: "Interviews", hint: "Scheduling and feedback" },
  classification: { label: "Classification", hint: "Job categories" },
  access: { label: "Candidate access", hint: "Logins and codes for candidates" },
};

const RANK: Record<Level, number> = { none: 0, view: 1, edit: 2 };

export function levelAtLeast(have: Level, need: Level): boolean {
  return RANK[have] >= RANK[need];
}

const all = (l: Level): Permissions => ({ candidates: l, jobs: l, applications: l, interviews: l, classification: l, access: l });

export type RolePreset = { key: string; label: string; description: string; permissions: Permissions };

/** Ready-made roles. Picking one fills the permissions, which can still be adjusted. */
export const ROLE_PRESETS: RolePreset[] = [
  { key: "admin", label: "Administrator", description: "Everything, including users and settings.", permissions: all("edit") },
  {
    key: "recruiter",
    label: "Recruiter",
    description: "Manages jobs, candidates, applications and interviews.",
    permissions: { candidates: "edit", jobs: "edit", applications: "edit", interviews: "edit", classification: "view", access: "none" },
  },
  {
    key: "interviewer",
    label: "Interviewer",
    description: "Sees candidates and applications and runs interviews.",
    permissions: { candidates: "view", jobs: "view", applications: "view", interviews: "edit", classification: "none", access: "none" },
  },
  {
    key: "data-entry",
    label: "Data entry",
    description: "Adds and corrects candidate profiles only.",
    permissions: { candidates: "edit", jobs: "view", applications: "none", interviews: "none", classification: "none", access: "none" },
  },
  {
    key: "access-officer",
    label: "Candidate access officer",
    description: "Creates logins for candidates and looks at their profiles.",
    permissions: { candidates: "view", jobs: "none", applications: "none", interviews: "none", classification: "none", access: "edit" },
  },
  { key: "viewer", label: "Viewer", description: "Can look at everything except candidate logins; changes nothing.", permissions: { ...all("view"), access: "none" } },
];

export function presetByKey(key: string): RolePreset | undefined {
  return ROLE_PRESETS.find((p) => p.key === key);
}

/** Which preset (if any) matches these permissions exactly; otherwise "custom". */
export function presetKeyFor(role: string, p: Permissions): string {
  if (role === "admin") return "admin";
  const hit = ROLE_PRESETS.find((r) => r.key !== "admin" && AREAS.every((a) => r.permissions[a] === p[a]));
  return hit ? hit.key : "custom";
}

/** Parse the stored JSON; unknown keys/levels are ignored. Returns null when nothing valid is stored. */
export function parsePermissions(raw: string | null | undefined): Permissions | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out = all("none");
    let any = false;
    for (const a of AREAS) {
      const v = o[a];
      if (v === "none" || v === "view" || v === "edit") {
        out[a] = v;
        any = true;
      }
    }
    return any ? out : null;
  } catch {
    return null;
  }
}

/** The permissions a user really has. Old accounts (nothing stored) get the Recruiter defaults. */
export function resolvePermissions(role: string, raw: string | null | undefined): Permissions {
  if (role === "admin") return all("edit");
  return parsePermissions(raw) ?? { ...ROLE_PRESETS[1].permissions };
}

/** Clean permissions coming from a request body. */
export function sanitizePermissions(input: unknown): Permissions {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out = all("none");
  for (const a of AREAS) {
    const v = o[a];
    out[a] = v === "view" || v === "edit" ? v : "none";
  }
  return out;
}

export function can(p: Permissions, area: Area, need: Level = "view"): boolean {
  return levelAtLeast(p[area], need);
}
