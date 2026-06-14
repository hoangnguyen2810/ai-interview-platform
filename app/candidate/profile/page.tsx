"use client";

import { useState } from "react";

import CandidateHeader from "@/app/components/candidate-profile/CandidateHeader";
import CVCard from "@/app/components/candidate-profile/CVCard";

import ProfileStatusCard from "@/app/components/candidate-profile/ProfileStatusCard";
import SocialLinksCard from "@/app/components/candidate-profile/SocialLinksCard";

import { TopNavBar } from "@/app/components/TopNavBar";
import CandidateStatsCards from "@/app/components/candidate-profile/CandidateStatsCards";
import EditProfileModal from "@/app/components/candidate-profile/EditProfileModal";
import { CandidateSideNavBar } from "@/app/components/CandidateSideNavBar";

export default function CandidateProfilePage() {
  const [openEdit, setOpenEdit] = useState(false);

  return (
    <div className="flex h-screen bg-surface text-on-surface overflow-hidden">
      <CandidateSideNavBar />

      <div className="flex-1 flex flex-col ml-sidebar-width">
        <TopNavBar />

        <main className="flex-1 overflow-y-auto mt-16 p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            <CandidateHeader onEdit={() => setOpenEdit(true)} />

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <SocialLinksCard />
              </div>

              <ProfileStatusCard />
            </div>

            <CandidateStatsCards />

            <CVCard />
          </div>
        </main>
      </div>

      <EditProfileModal open={openEdit} onClose={() => setOpenEdit(false)} />
    </div>
  );
}
