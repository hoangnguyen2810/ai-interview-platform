// ===== Shared types for profile API =====

export type Role = "CANDIDATE" | "RECRUITER" | "ADMIN";

export interface CandidateProfile {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  joinedAt: string | null;
  lastLoginAt: string | null;
  avatarUrl: string;
  phone: string;
  cvUrl: string;
  githubUrl: string;
  linkedinUrl: string;
  experienceYears: number;
  status: {
    phone: boolean;
    github: boolean;
    linkedin: boolean;
    cv: boolean;
  };
}

export interface CandidateStats {
  totalApplications: number;
  totalInterviews: number;
  offersReceived: number;
  savedJobs: number;
}

export interface RecruiterCompany {
  name: string;
  website: string;
  logoUrl: string;
  description: string;
}

export interface RecruiterProfile {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  joinedAt: string | null;
  lastLoginAt: string | null;
  avatarUrl: string;
  coverImageUrl: string;
  position: string;
  phone: string;
  bio: string;
  linkedinUrl: string;
  companyId: string | null;
  company: RecruiterCompany;
}

export interface RecruiterActivity {
  type: string;
  text: string;
  at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  profile?: T;
  stats?: unknown;
  activities?: RecruiterActivity[];
  profileCompletion?: number;
}
