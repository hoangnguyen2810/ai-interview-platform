"use client";

import { useEffect, useState } from "react";
import QuestionsDrawer from "./QuestionsDrawer";
import ChatDrawer from "./ChatDrawer";
import ParticipantsDrawer from "./ParticipantsDrawer";
import AIDrawer from "./AIDrawer";
import { useCallStateHooks } from "@stream-io/video-react-sdk";
import type { Call } from "@stream-io/video-react-sdk";

export default function FooterControls({
  role,
  participantRole,
  onOpenLiveCoding,
  userFullName,
  otherParticipantName,
  call,
  meetingCode,
}: {
  role: "candidate" | "recruiter";
  participantRole: "CANDIDATE" | "HOST" | "CO_HOST";
  onOpenLiveCoding: () => void;
  userFullName: string;
  otherParticipantName: string | null;
  call: Call | null;
  meetingCode: string;
}) {
  const { useMicrophoneState, useCameraState, useScreenShareState } =
    useCallStateHooks();

  const micState = useMicrophoneState();
  const camState = useCameraState();
  const screenState = useScreenShareState();

  const mic = micState.microphone;
  const cam = camState.camera;
  console.log("camState", camState);
  console.log("camera", cam);
  const screen = screenState.screenShare;

  const isMicOn = !micState.isMute;
  const isCamOn = !camState.isMute;
  const isScreenSharing = screenState.isMute;

  const [showChat, setShowChat] = useState(false);
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
            onClick={() => mic.toggle()}
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
              } catch (err: any) {
                if (err?.name === "NotReadableError") {
                  alert("Camera đang được sử dụng bởi ứng dụng hoặc tab khác.");
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
              <div className="absolute bottom-16 right-0 w-72 bg-[#0d1c2d]/95 backdrop-blur-xl border border-[#3b494b] rounded-xl p-3 shadow-2xl z-50 cursor-pointer">
                {/* MIC */}
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

                {/* CAMERA */}
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

          {/* SCREEN SHARE */}
          <button
            onClick={() => screen.toggle()}
            className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-200 cursor-pointer ${
              isScreenSharing
                ? "bg-[#122131] border-[#3b494b] hover:border-cyan-400"
                : "bg-red-500 border-red-400"
            }`}
          >
            <span className="material-symbols-outlined">screen_share</span>
          </button>

          {/* END CALL */}
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="w-14 h-14 rounded-full flex items-center justify-center border border-red-500 bg-red-600 text-white cursor-pointer"
          >
            <span className="material-symbols-outlined rotate-[135deg]">
              call_end
            </span>
          </button>

          {/* LIVE CODING */}
          <button
            onClick={onOpenLiveCoding}
            className="w-14 h-14 rounded-full flex items-center justify-center border border-cyan-400 text-cyan-300 cursor-pointer"
          >
            <span className="material-symbols-outlined">terminal</span>
          </button>

          {/* PARTICIPANTS */}
          <button
            onClick={() => setShowParticipants(true)}
            className="w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">groups</span>
          </button>

          {/* CHAT */}
          <button
            onClick={() => setShowChat(true)}
            className="w-11 h-11 rounded-full flex items-center justify-center border border-[#3b494b] cursor-pointer"
          >
            <span className="material-symbols-outlined">chat</span>
          </button>
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
      />

      {isRecruiter && (
        <>
          <AIDrawer open={showAI} onClose={() => setShowAI(false)} />
          <QuestionsDrawer
            open={showQuestions}
            onClose={() => setShowQuestions(false)}
          />
        </>
      )}
    </>
  );
}
