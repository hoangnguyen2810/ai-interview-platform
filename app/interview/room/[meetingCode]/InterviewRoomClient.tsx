"use client";

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
  hasScreenShare,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { ChatProvider } from "@/app/components/interview-room/ChatContext";
import { useCamMicSync } from "@/app/components/interview-room/CamMicSyncContext";
import { useEffect, useRef, useState } from "react";
import type {
  Call,
  StreamVideoClient,
  UserResponse,
} from "@stream-io/video-react-sdk";
import CandidateCodingView from "@/app/components/interview-room/coding/CandidateCodingView";
import RecruiterCodingView from "@/app/components/interview-room/coding/RecruiterCodingView";

interface Props {
  meetingCode: string;
  title: string;
  participantRole: InterviewRole;
  userFullName: string;
  otherParticipantName: string | null;
  userId: string;
}

function MeetingGrid() {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();

  let cols = "grid-cols-1";
  const count = participants.length;

  if (count === 2) cols = "grid-cols-2";
  else if (count >= 3 && count <= 4) cols = "grid-cols-2";
  else if (count > 4) cols = "grid-cols-3";

  return (
    <div className={`grid ${cols} gap-4 w-full h-full p-2`}>
      {participants.map((p) => (
        <div
          key={p.sessionId}
          className="w-full h-full min-h-[300px] rounded-3xl overflow-hidden bg-black flex items-center justify-center"
        >
          <ParticipantView
            participant={p}
            trackType={hasScreenShare(p) ? "screenShareTrack" : "videoTrack"}
          />
        </div>
      ))}
    </div>
  );
}

export default function InterviewRoomClient({
  meetingCode,
  title,
  participantRole,
  userFullName,
  otherParticipantName,
  userId,
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

  const isHost = participantRole === "HOST";

  const { readPersisted, setCameraEnabled, setMicEnabled } = useCamMicSync();

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
          name: userFullName,
          role,
        };

        const client = createStreamClient(apiKey, user, token);
        const streamCall = client.call("default", meetingCode);

        await streamCall.join({ create: true });

        // allow SDK to stabilize
        await new Promise((r) => setTimeout(r, 300));

        // Read persisted cam/mic state from CamMicSyncContext (shared across waiting → room)
        const { camera: camOn, mic: micOn } = readPersisted();

        if (micOn) await streamCall.microphone.enable();
        else await streamCall.microphone.disable();

        if (camOn) {
          try {
            await streamCall.camera.enable();
          } catch (e) {
            console.warn("Camera retry...", e);
            setTimeout(() => {
              streamCall.camera.enable().catch(console.error);
            }, 500);
          }
        } else {
          await streamCall.camera.disable();
        }

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
  }, [meetingCode, role, userFullName, readPersisted]);

  // Sync SDK cam/mic track state → sessionStorage so waiting room reflects changes
  useEffect(() => {
    if (!streamReady || !call) return;
    const id = window.setInterval(() => {
      const micTrack = call.state?.mediaStream?.getAudioTracks()[0];
      const camTrack = call.state?.mediaStream?.getVideoTracks()[0];
      if (micTrack) setMicEnabled(!micTrack.muted);
      if (camTrack) setCameraEnabled(!camTrack.muted);
    }, 500);
    return () => clearInterval(id);
  }, [streamReady, call, setCameraEnabled, setMicEnabled]);

  // Host enter tracking
  useEffect(() => {
    if (!isHost || hostEnterCalledRef.current) return;
    hostEnterCalledRef.current = true;

    fetch(`/api/interviews/${encodeURIComponent(meetingCode)}/host-enter`, {
      method: "POST",
    }).catch(console.error);
  }, [isHost, meetingCode]);

  // cookie sync
  useEffect(() => {
    if (!streamReady) return;
    document.cookie = `interview_meeting_code=${encodeURIComponent(
      meetingCode,
    )}; path=/; SameSite=Lax`;
  }, [streamReady, meetingCode]);

  // cleanup
  useEffect(() => {
    return () => {
      call?.leave().catch(console.error);
      streamClient?.disconnectUser().catch(console.error);
    };
  }, [call, streamClient]);

  if (streamError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-red-400 text-lg">Stream connection failed</p>
          <p className="text-sm text-gray-400">{streamError}</p>
        </div>
      </div>
    );
  }

  return (
    <ChatProvider call={call} meetingCode={meetingCode} currentUserId={userId}>
      <StreamVideo client={streamClient}>
        <StreamCall call={call}>
          <div className="h-screen w-screen bg-[#051424] text-white flex flex-col">
            <Header title={title} meetingCode={meetingCode} role={role} />

            <main className="flex-1 flex gap-4 p-4 overflow-hidden">
              {/* VIDEO */}
              <div className={showLiveCoding ? "w-[45%]" : "w-full"}>
                <div className="h-full rounded-3xl border border-[#163149] bg-[#07131f] overflow-hidden">
                  {streamReady ? (
                    <MeetingGrid />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      Loading...
                    </div>
                  )}
                </div>
              </div>
              {showLiveCoding && (
                <div className="w-[55%]">
                  {role === "candidate" ? (
                    <CandidateCodingView />
                  ) : (
                    <RecruiterCodingView />
                  )}
                </div>
              )}
              {/* CODING */}
            </main>

            {streamReady && (
              <FooterControls
                role={role}
                onOpenLiveCoding={() => setShowLiveCoding((p) => !p)}
                userFullName={userFullName}
                otherParticipantName={otherParticipantName}
                call={call}
                participantRole={participantRole}
                meetingCode={meetingCode}
              />
            )}

            <QuestionsDrawer
              open={questionOpen}
              onClose={() => setQuestionOpen(false)}
            />
          </div>
        </StreamCall>
      </StreamVideo>
    </ChatProvider>
  );
}
