"use client";

import { useCallback, useEffect, useState } from "react";

import AccountInfo from "@/app/components/recruiter-profile/AccountInfo";
import ActivityTimeline from "@/app/components/recruiter-profile/ActivityTimeline";
import CompanyInfo from "@/app/components/recruiter-profile/CompanyInfo";
import EditRecruiterModal from "@/app/components/recruiter-profile/EditRecruiterModal";
import PersonalInfo from "@/app/components/recruiter-profile/PersonalInfo";
import ProfileCompletion from "@/app/components/recruiter-profile/ProfileCompletion";
import ProfileHeader from "@/app/components/recruiter-profile/ProfileHeader";

import { SideNavBar } from "@/app/components/SideNavBar";
import { TopNavBar } from "@/app/components/TopNavBar";

import { fetchRecruiterProfile } from "@/lib/profile-api";
import type { RecruiterActivity, RecruiterProfile } from "@/lib/profile-types";

const EMPTY_PROFILE: RecruiterProfile = {
  userId: "",
  email: "",
  fullName: "",
  role: "RECRUITER",
  isActive: false,
  joinedAt: null,
  lastLoginAt: null,
  avatarUrl: "",
  coverImageUrl: "",
  position: "",
  phone: "",
  bio: "",
  linkedinUrl: "",
  companyId: null,
  company: { name: "", website: "", description: "", logoUrl: "" },
};

export default function RecruiterProfilePage() {
  const [profile, setProfile] = useState<RecruiterProfile>(EMPTY_PROFILE);

  const [activities, setActivities] = useState<RecruiterActivity[]>([]);
  const [openEdit, setOpenEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { profile, activities } = await fetchRecruiterProfile();
      setProfile(profile);
      setActivities(activities);
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
    <div className="bg-surface text-on-surface min-h-screen">
      <SideNavBar />
      <TopNavBar />

      <main className="pt-16 ml-sidebar-width h-screen overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {loading && !profile.userId ? (
            <div className="p-12 rounded-xl border border-outline-variant bg-surface-container text-center text-on-surface-variant">
              Đang tải hồ sơ...
            </div>
          ) : (
            <>
              <ProfileHeader
                profile={profile}
                onEdit={() => setOpenEdit(true)}
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <PersonalInfo profile={profile} />
                  <CompanyInfo profile={profile} />

                  <ActivityTimeline activities={activities} />
                </div>

                <div className="space-y-8">
                  <ProfileCompletion profile={profile} />
                  <AccountInfo profile={profile} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <EditRecruiterModal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        profile={profile}
        onSaved={(next) => {
          setProfile(next);
          load();
        }}
      />
    </div>
  );
}
