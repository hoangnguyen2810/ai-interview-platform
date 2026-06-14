import AccountInfo from "@/app/components/recruiter-profile/AccountInfo";
import ActivityTimeline from "@/app/components/recruiter-profile/ActivityTimeline";
import CompanyInfo from "@/app/components/recruiter-profile/CompanyInfo";
import PersonalInfo from "@/app/components/recruiter-profile/PersonalInfo";
import ProfileCompletion from "@/app/components/recruiter-profile/ProfileCompletion";
import ProfileHeader from "@/app/components/recruiter-profile/ProfileHeader";
import Security from "@/app/components/recruiter-profile/Security";
import StatsCard from "@/app/components/recruiter-profile/StatsCards";
import { SideNavBar } from "@/app/components/SideNavBar";
import { TopNavBar } from "@/app/components/TopNavBar";

export default function RecruiterProfilePage() {
  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <SideNavBar />
      <TopNavBar />

      {/* MAIN CONTENT - BÙ LAYOUT FIXED */}
      <main className="pt-16 ml-sidebar-width h-screen overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
          <ProfileHeader />
          <StatsCard />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <PersonalInfo />
              <CompanyInfo />
              <AccountInfo />
              <ActivityTimeline />
            </div>

            <div className="space-y-8">
              <ProfileCompletion />
              <Security />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
