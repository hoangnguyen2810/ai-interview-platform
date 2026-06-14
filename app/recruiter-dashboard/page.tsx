import { TopNavBar } from "../components/TopNavBar";
import { SideNavBar } from "../components/SideNavBar";
import { MobileBottomNav } from "../components/MobileBottomNav";
import { HeroSection } from "../components/HeroSection";
import { QuickStats } from "../components/QuickStats";
import { UpcomingInterviews } from "../components/UpcomingInterviews";
import { RecentEvaluations } from "../components/RecentEvaluations";
import { AIAssistantPanel } from "../components/AIAssistantPanel";

export default function DashboardPage() {
  return (
    <>
      <TopNavBar />
      <div className="flex pt-16 h-screen overflow-hidden">
        <SideNavBar />
        <main className="flex-grow md:ml-sidebar-width overflow-y-auto bg-background p-6 md:p-margin-desktop pb-24 md:pb-margin-desktop">
          <HeroSection />
          <QuickStats />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
            <div className="lg:col-span-2 space-y-6">
              <UpcomingInterviews />
              <RecentEvaluations />
            </div>
            <AIAssistantPanel />
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </>
  );
}
