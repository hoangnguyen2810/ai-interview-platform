"use client";

import CodeEditor from "@/app/components/interview-room/CodeEditor";
import FooterControls from "@/app/components/interview-room/FooterControls";
import Header from "@/app/components/interview-room/Header";
import QuestionsDrawer from "@/app/components/interview-room/QuestionsDrawer";
import Sidebar from "@/app/components/interview-room/Sidebar";
import { useState } from "react";

export default function InterviewRoomPage() {
  const [questionOpen, setQuestionOpen] = useState(false);
  const [showLiveCoding, setShowLiveCoding] = useState(false);

  return (
    <div className="h-screen w-screen bg-[#051424] text-white overflow-hidden flex flex-col items-center justify-between p-4 md:p-8 font-sans">
      <Header />

      <main className="flex-grow w-full max-w-[1600px] flex gap-6 p-4 md:p-6 overflow-hidden">
        <div
          className={`transition-all duration-500 ${
            showLiveCoding ? "w-[30%]" : "w-full"
          }`}
        >
          <Sidebar showLiveCoding={showLiveCoding} />
        </div>

        {showLiveCoding && (
          <div className="w-[70%] animate-in slide-in-from-right duration-500">
            <CodeEditor />
          </div>
        )}
      </main>

      <FooterControls
        onOpenQuestions={() => setQuestionOpen(true)}
        onOpenLiveCoding={() => setShowLiveCoding((prev) => !prev)}
      />

      <QuestionsDrawer
        open={questionOpen}
        onClose={() => setQuestionOpen(false)}
      />
    </div>
  );
}
