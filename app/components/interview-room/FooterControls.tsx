"use client";

import React, { useEffect, useRef, useState } from "react";
import QuestionsDrawer from "./QuestionsDrawer";
interface FooterControlsProps {
  onOpenQuestions: () => void;
  onOpenLiveCoding?: () => void;
  onStreamReady?: (stream: MediaStream | null) => void;
  onScreenShare?: (stream: MediaStream | null) => void;
  onEndCall?: () => void;
}

export default function FooterControls({
  onOpenQuestions,
  onOpenLiveCoding,
  onStreamReady,
  onScreenShare,
  onEndCall,
}: FooterControlsProps) {
  const streamRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);

  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showLiveCoding, setShowLiveCoding] = useState(false);

  // INIT CAMERA + MIC
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });

        if (!mounted) return;

        streamRef.current = stream;
        onStreamReady?.(stream);
      } catch (err) {
        console.error("Device error:", err);
      }
    };

    init();

    return () => {
      mounted = false;

      streamRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onStreamReady]);

  // MIC TOGGLE
  const toggleMic = () => {
    const stream = streamRef.current;
    if (!stream) return;

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return;

    const enabled = !audioTracks[0].enabled;
    audioTracks.forEach((t) => (t.enabled = enabled));

    setMicEnabled(enabled);
  };

  // CAMERA TOGGLE
  const toggleCamera = () => {
    const stream = streamRef.current;
    if (!stream) return;

    const videoTracks = stream.getVideoTracks();
    if (!videoTracks.length) return;

    const enabled = !videoTracks[0].enabled;
    videoTracks.forEach((t) => (t.enabled = enabled));

    setCameraEnabled(enabled);
  };

  // SHARE SCREEN
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

      track.onended = () => {
        stopScreenShare();
      };
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

  // END CALL
  const endCall = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current?.getTracks().forEach((t) => t.stop());

    streamRef.current = null;
    screenRef.current = null;

    setMicEnabled(false);
    setCameraEnabled(false);
    setIsSharingScreen(false);

    onStreamReady?.(null);
    onScreenShare?.(null);
    onEndCall?.();
  };

  return (
    <>
      <footer className="w-full max-w-6xl mb-4">
        <div className="glass-panel rounded-full px-6 py-4 flex items-center shadow-2xl">
          {/* MEDIA */}
          <div className="flex items-center gap-3">
            {/* MIC */}
            <button
              onClick={toggleMic}
              title={micEnabled ? "Turn off microphone" : "Turn on microphone"}
              className={`relative group p-3 rounded-full transition-all flex items-center justify-center ${
                micEnabled
                  ? "bg-[#122131] border border-[#3b494b] hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]"
                  : "bg-red-500 border border-red-400 hover:shadow-[0_0_12px_rgba(255,0,0,0.4)]"
              }`}
            >
              <span className="material-symbols-outlined text-white">
                {micEnabled ? "mic" : "mic_off"}
              </span>
            </button>

            {/* CAMERA */}
            <button
              onClick={toggleCamera}
              title={cameraEnabled ? "Turn off camera" : "Turn on camera"}
              className={`relative group p-3 rounded-full transition-all flex items-center justify-center ${
                cameraEnabled
                  ? "bg-[#122131] border border-[#3b494b] hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]"
                  : "bg-red-500 border border-red-400 hover:shadow-[0_0_12px_rgba(255,0,0,0.4)]"
              }`}
            >
              <span className="material-symbols-outlined text-white">
                {cameraEnabled ? "videocam" : "videocam_off"}
              </span>
            </button>

            {/* SETTINGS */}
            <button
              title="Settings"
              className="relative group p-3 rounded-full transition-all flex items-center justify-center bg-[#122131] border border-[#3b494b] hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]"
            >
              <span className="material-symbols-outlined text-white transition-transform duration-300 group-hover:rotate-90">
                settings
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="mx-5 h-8 w-px bg-[#3b494b]" />

          {/* CALL ACTIONS */}
          <div className="flex items-center gap-3">
            <button
              onClick={isSharingScreen ? stopScreenShare : shareScreen}
              title="Share screen"
              className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${
                isSharingScreen
                  ? "bg-cyan-500 text-black border-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.5)]"
                  : "bg-[#122131] border-[#3b494b] text-gray-300 hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]"
              }`}
            >
              <span className="material-symbols-outlined">screen_share</span>
            </button>

            <button
              onClick={endCall}
              title="End call"
              className="w-12 h-12 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition-all"
            >
              <span className="material-symbols-outlined rotate-[135deg]">
                call_end
              </span>
            </button>
          </div>

          {/* Đẩy phần còn lại sang phải */}
          <div className="flex-1" />

          {/* UTILITIES */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={onOpenLiveCoding}
              className="
    flex items-center gap-2
    px-4 py-2
    rounded-full
    bg-cyan-500/15
    border border-cyan-400
    text-cyan-300
    font-semibold
    transition-all
    hover:bg-cyan-500/25
    hover:text-white
    hover:shadow-[0_0_18px_rgba(0,240,255,0.6)]
  "
            >
              <span className="material-symbols-outlined text-lg">
                terminal
              </span>
              <span>LIVE CODING</span>
            </button>

            <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#122131] border border-[#3b494b] text-gray-300 transition-all hover:text-white hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]">
              <span className="material-symbols-outlined text-lg">groups</span>
              <span>Participants</span>
            </button>

            <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#122131] border border-[#3b494b] text-gray-300 transition-all hover:text-white hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]">
              <span className="material-symbols-outlined text-lg">chat</span>
              <span>Chat</span>
            </button>
          </div>

          <div className="mx-5 h-8 w-px bg-[#3b494b] hidden lg:block" />

          {/* AI */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowQuestions(true)}
              className="
      flex items-center gap-2
      h-11
      px-5
      rounded-full
      bg-[#122131]
      border border-[#3b494b]
      text-white text-sm font-medium
      hover:border-cyan-400
      hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]
      transition-all
    "
            >
              <span className="material-symbols-outlined text-[18px]">
                quiz
              </span>
              <span>Questions</span>
            </button>

            <button
              className="
      flex items-center gap-2
      h-11
      px-5
      rounded-full
      bg-cyan-500
      text-[#051424]
      text-sm
      font-bold
      shadow-[0_0_20px_rgba(0,240,255,0.6)]
      transition-all duration-300
      hover:scale-105
      hover:shadow-[0_0_30px_rgba(0,240,255,0.9)]
    "
            >
              <span className="material-symbols-outlined text-[18px]">
                smart_toy
              </span>
              <span>AI Assistant</span>
            </button>
          </div>
        </div>
      </footer>
      <QuestionsDrawer
        open={showQuestions}
        onClose={() => setShowQuestions(false)}
      />
    </>
  );
}
