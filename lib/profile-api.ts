import type {
  CandidateProfile,
  CandidateStats,
  RecruiterActivity,
  RecruiterProfile,
  RecruiterStats,
} from "@/lib/profile-types";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

async function authedFetch(input: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      (json && typeof json.message === "string" && json.message) ||
      `Request failed (${res.status})`;
    const err = new Error(message);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  return json;
}

export async function fetchCandidateProfile(): Promise<{
  profile: CandidateProfile;
  stats: CandidateStats;
}> {
  const json = await authedFetch("/api/candidate/profile", { method: "GET" });
  return {
    profile: json.profile as CandidateProfile,
    stats: (json.stats as CandidateStats) ?? {
      totalApplications: 0,
      totalInterviews: 0,
      offersReceived: 0,
      savedJobs: 0,
    },
  };
}

export async function updateCandidateProfile(
  payload: Record<string, unknown>,
): Promise<number> {
  const json = await authedFetch("/api/candidate/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return typeof json.profileCompletion === "number"
    ? json.profileCompletion
    : 0;
}

export async function fetchRecruiterProfile(): Promise<{
  profile: RecruiterProfile;
  stats: RecruiterStats;
  activities: RecruiterActivity[];
}> {
  const json = await authedFetch("/api/recruiter/profile", { method: "GET" });
  return {
    profile: json.profile as RecruiterProfile,
    stats: (json.stats as RecruiterStats) ?? {
      openJobs: 0,
      applications: 0,
      aiInterviews: 0,
      hired: 0,
    },
    activities: (json.activities as RecruiterActivity[]) ?? [],
  };
}

export async function updateRecruiterProfile(
  payload: Record<string, unknown>,
): Promise<number> {
  const json = await authedFetch("/api/recruiter/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return typeof json.profileCompletion === "number"
    ? json.profileCompletion
    : 0;
}
