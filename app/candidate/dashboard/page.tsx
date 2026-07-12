"use client";

import { useEffect } from "react";
import { CandidateSideNavBar } from "@/app/components/CandidateSideNavBar";
import { JoinInterviewForm } from "@/app/components/candidate-dashboard/JoinInterviewForm";
import { InterviewHistoryList } from "@/app/components/candidate-dashboard/InterviewHistoryList";
import { TopNavBar } from "@/app/components/TopNavBar";

export default function CandidateDashboard() {
  useEffect(() => {
    console.log("NeuralCode AI Candidate Dashboard Initialized");
  }, []);

  return (
    <div className="flex min-h-screen bg-[#051424] text-[#d4e4fa]">
      {/* SIDEBAR */}
      <CandidateSideNavBar />

      {/* MAIN WRAPPER */}
      <div className="flex flex-col flex-1 min-h-screen">
        {/* TOP NAVBAR (fixed inside component) */}
        <TopNavBar />

        {/* MAIN CONTENT AREA */}
        <main className="pt-16 ml-[280px] h-screen overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* JOIN INTERVIEW */}
            <JoinInterviewForm />

            {/* CONTENT GRID */}
            <div className="grid grid-cols-12 gap-8">
              {/* LEFT — lịch sử phỏng vấn */}
              <div className="col-span-12 lg:col-span-8">
                <InterviewHistoryList />
              </div>

              {/* RIGHT — câu hỏi phỏng vấn */}
              <aside className="col-span-12 lg:col-span-4">
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <h3 className="text-xl font-bold">Câu hỏi phỏng vấn</h3>

                  {/* SEARCH */}
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                      search
                    </span>

                    <input
                      className="w-full bg-[#0d1c2d] border border-[#3b494b] rounded-lg py-2 pl-10 pr-4 text-sm"
                      placeholder="Tìm kiếm chủ đề..."
                    />
                  </div>

                  {/* ITEMS */}
                  <div className="space-y-3">
                    {[
                      "Data Structures",
                      "Algorithms",
                      "System Design",
                      "Frontend Core",
                    ].map((item) => (
                      <div
                        key={item}
                        className="p-3 rounded-lg hover:bg-[#1c2b3c] cursor-pointer flex justify-between"
                      >
                        <span>{item}</span>
                        <span className="material-symbols-outlined text-sm">
                          chevron_right
                        </span>
                      </div>
                    ))}
                  </div>

                  <button className="w-full py-2 rounded-lg bg-cyan-500/10 text-cyan-300 font-bold hover:bg-cyan-500/20 transition">
                    Luyện tập ngay
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}