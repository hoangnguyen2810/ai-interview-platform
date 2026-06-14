"use client";

import { useCallback, useEffect, useState } from "react";

import CandidateHeader from "@/app/components/candidate-profile/CandidateHeader";
import CVCard from "@/app/components/candidate-profile/CVCard";
import CandidateStatsCards from "@/app/components/candidate-profile/CandidateStatsCards";
import EditProfileModal from "@/app/components/candidate-profile/EditProfileModal";
import ProfileStatusCard from "@/app/components/candidate-profile/ProfileStatusCard";
import SocialLinksCard from "@/app/components/candidate-profile/SocialLinksCard";

import { CandidateSideNavBar } from "@/app/components/CandidateSideNavBar";
import { TopNavBar } from "@/app/components/TopNavBar";

import { fetchCandidateProfile } from "@/lib/profile-api";
import type {
  CandidateProfile as CandidateProfileData,
  CandidateStats,
} from "@/lib/profile-types";

const EMPTY_PROFILE: CandidateProfileData = {
  userId: "",
  email: "",
  fullName: "",
  role: "CANDIDATE",
  isActive: false,
  joinedAt: null,
  lastLoginAt: null,
  avatarUrl: "",
  phone: "",
  cvUrl: "",
  githubUrl: "",
  linkedinUrl: "",
  experienceYears: 0,
  status: { phone: false, github: false, linkedin: false, cv: false },
};

const EMPTY_STATS: CandidateStats = {
  totalApplications: 0,
  totalInterviews: 0,
  offersReceived: 0,
  savedJobs: 0,
};

export default function CandidateProfilePage() {
  const [openEdit, setOpenEdit] = useState(false);
  const [profile, setProfile] = useState<CandidateProfileData>(EMPTY_PROFILE);
  const [, setStats] = useState<CandidateStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { profile, stats } = await fetchCandidateProfile();
      setProfile(profile);
      setStats(stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải hồ sơ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex min-h-screen bg-surface text-on-surface">
      <CandidateSideNavBar />

      <div className="flex flex-col flex-1 min-h-screen">
        <TopNavBar />

        <main className="pt-16 ml-sidebar-width h-screen overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {loading && !profile.userId ? (
              <div className="glass-panel p-12 rounded-2xl text-center text-on-surface-variant">
                Đang tải hồ sơ...
              </div>
            ) : (
              <>
                <CandidateHeader
                  onEdit={() => setOpenEdit(true)}
                  profile={profile}
                />

                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <SocialLinksCard profile={profile} />
                  </div>

                  <ProfileStatusCard profile={profile} />
                </div>

                <CandidateStatsCards profile={profile} />
                <CVCard profile={profile} />
              </>
            )}
          </div>
        </main>
      </div>

      <EditProfileModal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        profile={profile}
        onSaved={() => {
          load();
        }}
      />
    </div>
  );
}
