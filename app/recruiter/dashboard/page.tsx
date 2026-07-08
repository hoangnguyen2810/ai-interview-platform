import { TopNavBar } from "../../components/TopNavBar";
import { SideNavBar } from "../../components/SideNavBar";
import { MobileBottomNav } from "../../components/recruiter-dashboard/MobileBottomNav";
import { HeroSection } from "../../components/recruiter-dashboard/HeroSection";
import { QuickStats } from "../../components/recruiter-dashboard/QuickStats";
import { UpcomingInterviews } from "../../components/recruiter-dashboard/UpcomingInterviews";
import { RecentInterviews } from "../../componen../../components/recruiter-dashboard/RecentInterviews";
import { AIAssistantPanel } from "@/app/components/recruiter-dashboard/AIAssistantPanel";
import { DashboardShell } from "@/app/components/recruiter-dashboard/DashboardShell";
import { JoinInterviewForm } from "@/app/components/candidate-dashboard/JoinInterviewForm";

export default function DashboardPage() {
  return (
    <DashboardShell>
      <TopNavBar />
      <div className="flex pt-16 h-screen overflow-hidden">
        <SideNavBar />
        <main className="flex-grow md:ml-sidebar-width overflow-y-auto bg-background p-6 md:p-margin-desktop pb-24 md:pb-margin-desktop">
          <HeroSection />
          <QuickStats />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
            <div className="lg:col-span-2 space-y-6">
              <JoinInterviewForm />
              <UpcomingInterviews />
              <RecentInterviews />
            </div>
            <AIAssistantPanel />
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </DashboardShell>
  );
}
