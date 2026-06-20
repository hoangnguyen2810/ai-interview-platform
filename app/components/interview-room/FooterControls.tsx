"use client";

import { useEffect, useRef, useState } from "react";
import QuestionsDrawer from "./QuestionsDrawer";
import ChatDrawer from "./ChatDrawer";
import ParticipantsDrawer from "./ParticipantsDrawer";
import AIDrawer from "./AIDrawer";
import { useMedia } from "./MediaContext";

interface FooterControlsProps {
  role: "candidate" | "recruiter";
  onOpenQuestions: () => void;
  onOpenLiveCoding?: () => void;
  onScreenShare?: (stream: MediaStream | null) => void;
  onEndCall?: () => void;
}

export default function FooterControls({
  role,
  onOpenQuestions,
  onOpenLiveCoding,
  onScreenShare,
  onEndCall,
}: FooterControlsProps) {
  const { stream, micEnabled: micOn, cameraEnabled: camOn, toggleMicro, toggleCamera } =
    useMedia();

  const screenRef = useRef<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const isRecruiter = role === "recruiter";

  useEffect(() => {
    return () => {
      screenRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenRef.current = screenStream;
      setIsSharingScreen(true);
      onScreenShare?.(screenStream);

      const track = screenStream.getVideoTracks()[0];
      track.onended = () => stopScreenShare();
    } catch (err) {
      console.error("Screen share error:", err);
    }
  };

  const stopScreenShare = () => {
    screenRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current = null;
    setIsSharingScreen(false);
    onScreenShare?.(null);
  };

  const startRecording = () => {
    if (!stream) return;

    recordedChunksRef.current = [];

    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm",
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, {
        type: "video/webm",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "recording.webm";
      a.click();
      URL.revokeObjectURL(url);
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const endCall = () => {
    screenRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current = null;

    setIsSharingScreen(false);
    setIsRecording(false);

    onScreenShare?.(null);
    onEndCall?.();
  };

  const iconBtn =
    "w-11 h-11 rounded-full flex items-center justify-center border transition-all";

  const pillBtn =
    "flex items-center gap-2 h-11 px-4 rounded-full border transition-all";

  return (
    <>
      <footer className="w-full max-w-6xl mb-4">
        <div className="glass-panel rounded-full px-5 py-3 flex items-center shadow-2xl">
          {/* MEDIA */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMicro}
              aria-label={micOn ? "Tắt micro" : "Bật micro"}
              aria-pressed={!micOn}
              className={`${iconBtn} ${
                micOn
                  ? "bg-[#122131] border-[#3b494b] hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]"
                  : "bg-red-500 border-red-400"
              }`}
            >
              <span className="material-symbols-outlined text-white">
                {micOn ? "mic" : "mic_off"}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleCamera}
              aria-label={camOn ? "Tắt camera" : "Bật camera"}
              aria-pressed={!camOn}
              className={`${iconBtn} ${
                camOn
                  ? "bg-[#122131] border-[#3b494b] hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]"
                  : "bg-red-500 border-red-400"
              }`}
            >
              <span className="material-symbols-outlined text-white">
                {camOn ? "videocam" : "videocam_off"}
              </span>
            </button>

            <button
              className={`${iconBtn} bg-[#122131] border-[#3b494b] hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]`}
            >
              <span className="material-symbols-outlined text-white group-hover:rotate-90 transition-transform">
                settings
              </span>
            </button>
          </div>

          <div className="mx-4 h-7 w-px bg-[#3b494b]" />

          {/* CALL ACTIONS */}
          <div className="flex items-center gap-2">
            <button
              onClick={isSharingScreen ? stopScreenShare : shareScreen}
              className={`${iconBtn} ${
                isSharingScreen
                  ? "bg-cyan-500 text-black border-cyan-300"
                  : "bg-[#122131] border-[#3b494b] text-gray-300 hover:border-cyan-400"
              }`}
            >
              <span className="material-symbols-outlined">screen_share</span>
            </button>

            {isRecruiter && (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`${iconBtn} ${
                  isRecording
                    ? "bg-red-600 text-white border-red-400"
                    : "bg-[#122131] border-[#3b494b] text-gray-300 hover:border-red-400"
                }`}
              >
                <span className="material-symbols-outlined">
                  {isRecording ? "stop" : "radio_button_checked"}
                </span>
              </button>
            )}

            <button
              onClick={endCall}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition-all"
            >
              <span className="material-symbols-outlined rotate-[135deg]">
                call_end
              </span>
            </button>
          </div>

          <div className="flex-1" />

          {/* UTILITIES */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={onOpenLiveCoding}
              className={`${pillBtn} bg-cyan-500/15 border-cyan-400 text-cyan-300 hover:bg-cyan-500/25`}
            >
              <span className="material-symbols-outlined text-lg">
                terminal
              </span>
              LIVE CODING
            </button>

            <button
              onClick={() => setShowParticipants(true)}
              className="
    flex items-center gap-2
    h-11 px-4
    rounded-full
    bg-[#122131]
    border border-[#3b494b]
    text-gray-300
    hover:text-white
    hover:border-cyan-400
    hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]
    transition-all
  "
            >
              <span className="material-symbols-outlined text-lg">groups</span>
              <span>Participants</span>
            </button>

            <button
              onClick={() => setShowChat(true)}
              className="
    flex items-center gap-2
    h-11 px-4
    rounded-full
    bg-[#122131]
    border border-[#3b494b]
    text-gray-300
    hover:text-white
    hover:border-cyan-400
    hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]
    transition-all
  "
            >
              <span className="material-symbols-outlined text-lg">chat</span>
              <span>Chat</span>
            </button>
          </div>

          <div className="mx-4 h-7 w-px bg-[#3b494b] hidden lg:block" />

          <div className="flex items-center gap-2">
            {isRecruiter && (
              <button
                onClick={() => setShowQuestions(true)}
                className={`${pillBtn} bg-[#122131] border-[#3b494b] text-white`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  quiz
                </span>
                Questions
              </button>
            )}

            {isRecruiter && (
              <button
                onClick={() => setShowAI(true)}
                className="
      flex items-center gap-2
      h-11 px-4
      rounded-full
      bg-cyan-500
      text-[#051424]
      text-sm font-bold
      shadow-[0_0_20px_rgba(0,240,255,0.6)]
      transition-all duration-300
      hover:scale-105
      hover:shadow-[0_0_30px_rgba(0,240,255,0.9)]
    "
              >
                <span className="material-symbols-outlined text-[18px]">
                  smart_toy
                </span>
                AI Assistant
              </button>
            )}
          </div>
        </div>
      </footer>
      <ChatDrawer open={showChat} onClose={() => setShowChat(false)} />
      <ParticipantsDrawer
        open={showParticipants}
        onClose={() => setShowParticipants(false)}
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
