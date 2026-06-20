"use client";

import CandidateCodingView from "@/app/components/interview-room/coding/CandidateCodingView";
import RecruiterCodingView from "@/app/components/interview-room/coding/RecruiterCodingView";
import FooterControls from "@/app/components/interview-room/FooterControls";
import Header from "@/app/components/interview-room/Header";
import LocalMediaPreview from "@/app/components/interview-room/LocalMediaPreview";
import QuestionsDrawer from "@/app/components/interview-room/QuestionsDrawer";
import Sidebar from "@/app/components/interview-room/Sidebar";
import type { InterviewRole } from "@/lib/interview-guard";
import { useEffect, useRef, useState } from "react";

interface Props {
  meetingCode: string;
  title: string;
  participantRole: InterviewRole;
}

export default function InterviewRoomClient({
  meetingCode,
  title,
  participantRole,
}: Props) {
  const [questionOpen, setQuestionOpen] = useState(false);
  const [showLiveCoding, setShowLiveCoding] = useState(false);

  const role: "candidate" | "recruiter" =
    participantRole === "CANDIDATE" ? "candidate" : "recruiter";

  const isCandidate = role === "candidate";
  const isHost = participantRole === "HOST";

  // Đánh dấu Host đã vào meeting room → waiting room của các user khác
  // sẽ enable nút "Vào phòng phỏng vấn".
  const hostEnterCalledRef = useRef(false);
  useEffect(() => {
    if (!isHost) return;
    if (hostEnterCalledRef.current) return;
    hostEnterCalledRef.current = true;

    fetch(
      `/api/interviews/${encodeURIComponent(meetingCode)}/host-enter`,
      { method: "POST" },
    ).catch((err) => {
      console.error("[host-enter] failed:", err);
    });
  }, [isHost, meetingCode]);

  const currentUser = isCandidate
    ? {
        name: "Candidate",
        role: "Candidate",
        avatar: "C",
        roleKey: "candidate" as const,
      }
    : {
        name: "Interviewer",
        role: "Interviewer",
        avatar: "I",
        roleKey: "recruiter" as const,
      };

  const otherParticipant = isCandidate
    ? { name: "Technical Interviewer", role: "Interviewer", avatar: "I" }
    : { name: "Candidate", role: "Candidate", avatar: "C" };

  return (
    <div className="h-screen w-screen bg-[#051424] text-white overflow-hidden flex flex-col items-center justify-between p-4 md:p-8 font-sans">
      <Header title={title} meetingCode={meetingCode} role={role} />

      <main className="flex-grow w-full max-w-[1600px] flex gap-6 p-4 md:p-6 overflow-hidden">
        <div
          className={`transition-all duration-500 ${
            showLiveCoding ? "w-[30%]" : "w-full"
          }`}
        >
          <Sidebar
            showLiveCoding={showLiveCoding}
            currentUser={currentUser}
            otherParticipant={otherParticipant}
            localPreviewSlot={
              <LocalMediaPreview
                label={currentUser.role}
                displayName={`${currentUser.name} (You)`}
              />
            }
          />
        </div>

        {showLiveCoding && (
          <div className="w-[70%] animate-in slide-in-from-right duration-500">
            {role === "candidate" ? (
              <CandidateCodingView />
            ) : (
              <RecruiterCodingView />
            )}
          </div>
        )}
      </main>

      <FooterControls
        role={role}
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
