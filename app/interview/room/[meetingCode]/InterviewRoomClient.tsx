"use client";

import CandidateCodingView from "@/app/components/interview-room/coding/CandidateCodingView";
import RecruiterCodingView from "@/app/components/interview-room/coding/RecruiterCodingView";
import FooterControls from "@/app/components/interview-room/FooterControls";
import Header from "@/app/components/interview-room/Header";
import QuestionsDrawer from "@/app/components/interview-room/QuestionsDrawer";
import type { InterviewRole } from "@/lib/interview-guard";
import { createStreamClient } from "@/lib/streamClient";
import {
  StreamVideo,
  StreamCall,
  ParticipantView,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { useEffect, useRef, useState } from "react";
import type {
  Call,
  StreamVideoClient,
  UserResponse,
} from "@stream-io/video-react-sdk";

interface Props {
  meetingCode: string;
  title: string;
  participantRole: InterviewRole;
}

function MeetingGrid() {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();

  const count = participants.length;

  let cols = "grid-cols-1";

  if (count === 2) {
    cols = "grid-cols-2";
  } else if (count >= 3 && count <= 4) {
    cols = "grid-cols-2";
  } else if (count > 4) {
    cols = "grid-cols-3";
  }

  return (
    <div className={`grid ${cols} gap-4 w-full h-full p-2`}>
      {participants.map((participant) => (
        <div
          key={participant.sessionId}
          className="w-full h-full min-h-[300px] rounded-3xl overflow-hidden bg-black flex items-center justify-center"
        >
          <div className="w-full h-full flex items-center justify-center">
            <ParticipantView participant={participant} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InterviewRoomClient({
  meetingCode,
  title,
  participantRole,
}: Props) {
  const [questionOpen, setQuestionOpen] = useState(false);
  const [showLiveCoding, setShowLiveCoding] = useState(false);

  const [streamClient, setStreamClient] = useState<StreamVideoClient | null>(
    null,
  );
  const [call, setCall] = useState<Call | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const role: "candidate" | "recruiter" =
    participantRole === "CANDIDATE" ? "candidate" : "recruiter";

  const isCandidate = role === "candidate";
  const isHost = participantRole === "HOST";

  const clientInitializedRef = useRef(false);
  const hostEnterCalledRef = useRef(false);

  useEffect(() => {
    if (clientInitializedRef.current) return;
    clientInitializedRef.current = true;

    async function initStream() {
      try {
        const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
        if (!apiKey) {
          setStreamError("Missing NEXT_PUBLIC_STREAM_API_KEY");
          return;
        }

        const userId = `${role}-${meetingCode}`;
        const res = await fetch("/api/stream/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        if (!res.ok) throw new Error("Failed to fetch Stream token");
        const { token } = await res.json();

        const user: UserResponse = {
          id: userId,
          name: isCandidate ? "Candidate" : "Interviewer",
          role: role,
        };

        const client = createStreamClient(apiKey, user, token);
        const streamCall = client.call("default", meetingCode);

        await streamCall.join({ create: true });

        setStreamClient(client);
        setCall(streamCall);
        setStreamReady(true);
      } catch (err) {
        console.error("[Stream] init error:", err);
        setStreamError(
          err instanceof Error ? err.message : "Stream init failed",
        );
      }
    }

    initStream();
  }, [meetingCode, role, isCandidate]);

  useEffect(() => {
    if (!isHost || hostEnterCalledRef.current) return;
    hostEnterCalledRef.current = true;

    fetch(`/api/interviews/${encodeURIComponent(meetingCode)}/host-enter`, {
      method: "POST",
    }).catch((err) => {
      console.error("[host-enter] failed:", err);
    });
  }, [isHost, meetingCode]);

  useEffect(() => {
    return () => {
      if (call) {
        call
          .leave()
          .catch((err) => console.error("[Stream] leave error:", err));
      }
      if (streamClient) {
        streamClient
          .disconnectUser()
          .catch((err) => console.error("[Stream] disconnect error:", err));
      }
    };
  }, [call, streamClient]);

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

  if (streamError) {
    return (
      <div className="h-screen w-screen bg-[#051424] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <span className="material-symbols-outlined text-red-400 text-5xl">
            videocam_off
          </span>
          <p className="text-lg">Stream connection failed</p>
          <p className="text-sm text-gray-400">{streamError}</p>
        </div>
      </div>
    );
  }

  return (
    <StreamVideo client={streamClient}>
      <StreamCall call={call}>
        <div className="h-screen w-screen bg-[#051424] text-white overflow-hidden flex flex-col font-sans">
          <Header title={title} meetingCode={meetingCode} role={role} />

          <main className="flex-1 w-full flex gap-4 p-4 overflow-hidden min-h-0">
            {/* VIDEO SECTION */}
            <div
              className={`transition-all duration-500 h-full flex flex-col ${
                showLiveCoding ? "w-[45%] md:w-[40%]" : "w-full"
              }`}
            >
              <div className="flex-1 min-h-0 rounded-3xl border border-[#163149] bg-[#07131f] shadow-xl overflow-hidden">
                {streamReady ? (
                  <MeetingGrid />
                ) : (
                  <div className="h-full flex items-center justify-center rounded-2xl bg-[#0d1c2d] border border-[#23384d]">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                      <p className="text-xs text-cyan-200">Kết nối video...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CODING SECTION */}
            {showLiveCoding && (
              <div className="w-full md:w-[60%] h-full animate-in slide-in-from-right duration-300">
                <div className="h-full rounded-3xl border border-[#163149] bg-[#0b1622] shadow-xl overflow-hidden">
                  {role === "candidate" ? (
                    <CandidateCodingView />
                  ) : (
                    <RecruiterCodingView />
                  )}
                </div>
              </div>
            )}
          </main>

          {streamReady && (
            <FooterControls
              role={role}
              onOpenQuestions={() => setQuestionOpen(true)}
              onOpenLiveCoding={() => setShowLiveCoding((prev) => !prev)}
            />
          )}

          <QuestionsDrawer
            open={questionOpen}
            onClose={() => setQuestionOpen(false)}
          />
        </div>
      </StreamCall>
    </StreamVideo>
  );
}
