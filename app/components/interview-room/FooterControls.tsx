"use client";

import { useEffect, useState } from "react";
import QuestionsDrawer from "./QuestionsDrawer";
import ChatDrawer from "./ChatDrawer";
import ParticipantsDrawer from "./ParticipantsDrawer";
import AIDrawer from "./AIDrawer";
import { useCallStateHooks } from "@stream-io/video-react-sdk";
import type { Call } from "@stream-io/video-react-sdk";
import { useChat } from "./ChatContext";
import { useRecording } from "./RecordingContext";

const SESSION_CAM = "meeting_cam";
const SESSION_MIC = "meeting_mic";

export default function FooterControls({
  role,
  participantRole,
  onOpenLiveCoding,
  userFullName,
  otherParticipantName,
  call,
  meetingCode,
  userId,
  enableRecording = false,
}: {
  role: "candidate" | "recruiter";
  participantRole: "CANDIDATE" | "HOST" | "INTERVIEWER";
  onOpenLiveCoding: () => void;
  userFullName: string;
  otherParticipantName: string | null;
  call: Call | null;
  meetingCode: string;
  userId: string;
  enableRecording?: boolean;
}) {
  const { useMicrophoneState, useCameraState, useScreenShareState } =
    useCallStateHooks();

  const micState = useMicrophoneState();
  const camState = useCameraState();
  const screenState = useScreenShareState();
  const isScreenSharing = screenState.isEnabled;

  const mic = micState.microphone;
  const cam = camState.camera;

  const isMicOn = !micState.isMute;
  const isCamOn = !camState.isMute;

  const toggleScreenShare = async () => {
    try {
      if (!call) {
        console.warn("[screenShare] call is null");
        return;
      }
      console.log("[screenShare] current:", isScreenSharing, "toggling...");
      await call.screenShare.toggle();
      console.log("[screenShare] toggled successfully");
    } catch (e) {
      console.error("screen share error:", e);
    }
  };

  const [showChat, setShowChat] = useState(false);
  const { unreadCount, markRead } = useChat();

  // RecordingProvider luôn wrap FooterControls trong InterviewRoomClient,
  // nên useRecording() luôn hợp lệ trong runtime thật.
  // Hook được gọi không điều kiện để tuân thủ React rules of hooks;
  // nếu `enableRecording=false` thì chỉ đơn giản là không render indicator.
  const recording = useOptionalRecording();
  const [isEnding, setIsEnding] = useState(false);
  function useOptionalRecording() {
    try {
      return useRecording();
    } catch {
      return null;
    }
  }

  /**
   * Xử lý End Call theo role:
   *  - HOST: stop recording → set interview FINISHED → end call trên
   *    Stream → leave → sync recordings → redirect /recruiter/dashboard.
   *  - INTERVIEWER (recruiter phụ, KHÔNG phải host): CHỈ leave call —
   *    KHÔNG stop recording, KHÔNG gọi /end, KHÔNG set FINISHED.
   *    Redirect /recruiter/dashboard (vẫn là recruiter, nhưng không
   *    được coi là người kết thúc phiên).
   *  - CANDIDATE: chỉ leave call, KHÔNG stop recording, KHÔNG set
   *    FINISHED. Redirect /candidate/dashboard.
   */
  const handleEndCall = async () => {
    if (isEnding) return; // chống double-click
    setIsEnding(true);

    // CHỈ HOST mới được coi là người kết thúc phiên.
    // INTERVIEWER (recruiter phụ tham gia phòng) KHÔNG được phép
    // stop recording / end call — trước đây bug do check
    // `participantRole === "HOST" || participantRole === "INTERVIEWER"`
    // khiến recruiter phụ rời phòng cũng dừng luôn ghi hình.
    const isHost = participantRole === "HOST";

    try {
      if (isHost) {
        // 1. Stop recording nếu đang chạy (đợi server xác nhận)
        if (
          recording &&
          (recording.status === "recording" || recording.status === "starting")
        ) {
          try {
            await recording.stop();
          } catch (err) {
            console.warn("[endCall] recording.stop() failed:", err);
          }
        }

        // 2. Set interview FINISHED + end call trên Stream (server-side)
        try {
          const token =
            typeof window !== "undefined"
              ? window.localStorage.getItem("token")
              : null;
          const headers: HeadersInit = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          await fetch(
            `/api/interviews/${encodeURIComponent(meetingCode)}/end`,
            {
              method: "POST",
              headers,
              credentials: "include",
            },
          );
        } catch (err) {
          console.warn("[endCall] POST /end failed:", err);
        }
      }

      // 3. Leave call (HOST, INTERVIEWER và CANDIDATE đều cần rời phòng)
      if (call) {
        try {
          await call.leave();
        } catch (err) {
          console.warn("[endCall] call.leave() failed:", err);
        }
      }

      // 4. Sync recordings từ Stream (chỉ HOST — vì interview đã FINISHED)
      if (isHost && recording?.enabled) {
        try {
          await recording.syncRecordings();
        } catch (err) {
          console.warn("[endCall] syncRecordings failed:", err);
        }
      }

      // 5. Thông báo dashboard (nếu recruiter còn mở tab dashboard ở
      //    background) để Upcoming/Recent refresh data. Chỉ phát khi
      //    thực sự kết thúc phiên (HOST).
      if (isHost && typeof window !== "undefined" && meetingCode) {
        try {
          window.dispatchEvent(
            new CustomEvent("neuralcode:interview-finished", {
              detail: { meetingCode },
            }),
          );
        } catch (err) {
          console.warn("[endCall] dispatchEvent failed:", err);
        }
      }
    } finally {
      // 6. Redirect theo role:
      //    - CANDIDATE → /candidate/dashboard
      //    - HOST và INTERVIEWER (đều là recruiter) → /recruiter/dashboard
      const redirectTo =
        participantRole === "CANDIDATE"
          ? "/candidate/dashboard"
          : "/recruiter/dashboard";
      window.location.href = redirectTo;
    }
  };

  const handleOpenChat = () => {
    setShowChat(true);
    markRead();
  };
  const [showParticipants, setShowParticipants] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);

  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(setDevices);
  }, []);

  const isRecruiter = role === "recruiter";

  return (
    <>
      <footer className="w-full max-w-5xl mb-4 mx-auto">
        <div className="glass-panel rounded-full px-6 py-3 flex items-center justify-center gap-3 shadow-2xl">
          {/* MIC */}
          <button
            onClick={() => {
              mic.toggle();
              // Persist so waiting room sees the change
              sessionStorage.setItem(SESSION_MIC, String(!isMicOn));
            }}
            className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-200 cursor-pointer ${
              isMicOn
                ? "bg-[#122131] border-[#3b494b] hover:border-cyan-400"
                : "bg-red-500 border-red-400"
            }`}
          >
            <span className="material-symbols-outlined">
              {isMicOn ? "mic" : "mic_off"}
            </span>
          </button>

          {/* CAMERA */}
          <button
            onClick={async () => {
              try {
                await cam.toggle();
                // Persist so waiting room sees the change
                sessionStorage.setItem(SESSION_CAM, String(!isCamOn));
              } catch (err: any) {
                if (err?.name === "NotReadableError") {
                  alert("Camera đang được dùng bởi ứng dụng khác.");
                } else {
                  alert("Không thể bật camera.");
                }
              }
            }}
            className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-200 cursor-pointer ${
              isCamOn
                ? "bg-[#122131] border-[#3b494b] hover:border-cyan-400"
                : "bg-red-500 border-red-400"
            }`}
          >
            <span className="material-symbols-outlined">
              {isCamOn ? "videocam" : "videocam_off"}
            </span>
          </button>

          {/* DEVICE SETTINGS */}
          <div className="relative">
            <button
              onClick={() => setShowDeviceSettings((p) => !p)}
              className="w-14 h-14 rounded-full flex items-center justify-center border bg-[#122131] border-[#3b494b] hover:border-cyan-400 cursor-pointer"
            >
              <span className="material-symbols-outlined">settings</span>
            </button>

            {showDeviceSettings && (
              <div className="absolute bottom-16 right-0 w-72 bg-[#0d1c2d]/95 backdrop-blur-xl border border-[#3b494b] rounded-xl p-3 shadow-2xl z-50">
                <div className="text-xs text-gray-400 mb-2">MIC INPUT</div>
                <select className="w-full mb-3 bg-[#122131] text-white p-2 rounded-lg border border-[#3b494b]">
                  {devices
                    .filter((d) => d.kind === "audioinput")
                    .map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || "Microphone"}
                      </option>
                    ))}
                </select>

                <div className="text-xs text-gray-400 mb-2">CAMERA</div>
                <select className="w-full bg-[#122131] text-white p-2 rounded-lg border border-[#3b494b]">
                  {devices
                    .filter((d) => d.kind === "videoinput")
                    .map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || "Camera"}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* SCREEN SHARE (FIXED) */}
          <button
            onClick={toggleScreenShare}
            className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-200 cursor-pointer ${
              isScreenSharing
                ? "bg-cyan-500 border-cyan-300 text-black"
                : "bg-[#122131] border-[#3b494b] hover:border-cyan-400"
            }`}
          >
            <span className="material-symbols-outlined">screen_share</span>
          </button>

          {/* END CALL */}
          <button
            onClick={handleEndCall}
            disabled={isEnding}
            title={
              participantRole === "HOST"
                ? "Kết thúc buổi phỏng vấn (toàn bộ phòng sẽ rời đi)"
                : "Rời khỏi phòng"
            }
            className="w-14 h-14 rounded-full flex items-center justify-center border border-red-500 bg-red-600 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEnding ? (
              <span className="material-symbols-outlined animate-spin">
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined rotate-[135deg]">
                call_end
              </span>
            )}
          </button>

          {/* LIVE CODING */}
          <button
            onClick={onOpenLiveCoding}
            className="w-14 h-14 rounded-full flex items-center justify-center border bg-[#122131] border-[#3b494b] hover:border-cyan-400 cursor-pointer"
          >
            <span className="material-symbols-outlined">terminal</span>
          </button>

          {/* PARTICIPANTS */}
          <button
            onClick={() => setShowParticipants(true)}
            className="w-14 h-14 rounded-full flex items-center justify-center border bg-[#122131] border-[#3b494b] hover:border-cyan-400 cursor-pointer"
          >
            <span className="material-symbols-outlined">groups</span>
          </button>

          {/* CHAT */}
          {/* FIX: thêm "relative" — badge unreadCount dùng absolute
              positioning nên cần cha positioned để định vị đúng vào
              góc trên-phải của nút, thay vì trôi theo ancestor xa hơn. */}
          <button
            onClick={handleOpenChat}
            className="relative w-14 h-14 rounded-full flex items-center justify-center border bg-[#122131] border-[#3b494b] hover:border-cyan-400 cursor-pointer"
          >
            <span className="material-symbols-outlined">chat</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-cyan-400 text-black text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* AI ASSISTANT */}
          {isRecruiter && (
            <button
              onClick={() => setShowAI(true)}
              className="w-14 h-14 rounded-full flex items-center justify-center border border-purple-400 text-purple-300 hover:bg-purple-500/20 cursor-pointer"
              title="AI Assistant"
            >
              <span className="material-symbols-outlined">smart_toy</span>
            </button>
          )}

          {/* QUESTIONS */}
          {isRecruiter && (
            <button
              onClick={() => setShowQuestions(true)}
              className="w-14 h-14 rounded-full flex items-center justify-center border border-amber-400 text-amber-300 hover:bg-amber-500/20 cursor-pointer"
              title="Questions"
            >
              <span className="material-symbols-outlined">quiz</span>
            </button>
          )}
        </div>
      </footer>

      <ChatDrawer open={showChat} onClose={() => setShowChat(false)} />

      <ParticipantsDrawer
        open={showParticipants}
        onClose={() => setShowParticipants(false)}
        userFullName={userFullName}
        currentUserRole={role}
        participantRole={participantRole}
        meetingCode={meetingCode}
        userId={userId}
      />

      {isRecruiter && (
        <>
          <AIDrawer
            open={showAI}
            onClose={() => setShowAI(false)}
            meetingCode={meetingCode}
          />
          <QuestionsDrawer
            open={showQuestions}
            onClose={() => setShowQuestions(false)}
            role={role}
            meetingCode={meetingCode}
          />
        </>
      )}
    </>
  );
}

/**
 * Wrapper an toàn cho useRecording: trả về null nếu component bị render
 * ngoài <RecordingProvider>. Trong runtime thật Provider luôn wrap, nhưng
 * helper này giúp tránh throw error nếu footer bị mount riêng lẻ.
 */
