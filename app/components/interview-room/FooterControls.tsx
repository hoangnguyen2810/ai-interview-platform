"use client";

import React, { useEffect, useRef, useState } from "react";

interface FooterControlsProps {
  onOpenQuestions: () => void;
  onStreamReady?: (stream: MediaStream | null) => void;
  onScreenShare?: (stream: MediaStream | null) => void;
  onEndCall?: () => void;
}

export default function FooterControls({
  onOpenQuestions,
  onStreamReady,
  onScreenShare,
  onEndCall,
}: FooterControlsProps) {
  const streamRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);

  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

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
    <footer className="w-full max-w-5xl mb-4">
      <div className="glass-panel rounded-full px-6 py-4 flex items-center justify-between shadow-2xl">
        {/* MEDIA TOGGLES (GIỐNG UI CŨ) */}
        <div className="flex items-center space-x-3">
          {/* MIC */}
          <button
            onClick={toggleMic}
            title={micEnabled ? "Turn off microphone" : "Turn on microphone"}
            className={`relative group p-3 rounded-full transition-all flex items-center justify-center
            ${
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
            className={`relative group p-3 rounded-full transition-all flex items-center justify-center
            ${
              cameraEnabled
                ? "bg-[#122131] border border-[#3b494b] hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]"
                : "bg-red-500 border border-red-400 hover:shadow-[0_0_12px_rgba(255,0,0,0.4)]"
            }`}
          >
            <span className="material-symbols-outlined text-white">
              {cameraEnabled ? "videocam" : "videocam_off"}
            </span>
          </button>
        </div>

        {/* MAIN ACTIONS */}
        <div className="flex items-center space-x-3">
          {/* SCREEN SHARE */}
          <button
            onClick={isSharingScreen ? stopScreenShare : shareScreen}
            title="Share screen"
            className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all
            ${
              isSharingScreen
                ? "bg-cyan-500 text-black border-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.5)]"
                : "bg-[#122131] border-[#3b494b] text-gray-300 hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]"
            }`}
          >
            <span className="material-symbols-outlined">screen_share</span>
          </button>

          {/* END CALL */}
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

        {/* UTILITIES (GIỮ STYLE CŨ) */}
        <div className="hidden lg:flex items-center space-x-4 text-gray-400 text-sm">
          <button className="hover:text-white transition">Participants</button>
          <button className="hover:text-white transition">Chat</button>
          <button className="hover:text-white transition">Settings</button>
        </div>

        {/* AI SECTION (GIỮ STYLE INTERVIEW ROOM) */}
        <div className="ml-4 flex items-center gap-3">
          <button
            onClick={onOpenQuestions}
            className="px-4 py-2 rounded-lg bg-surface-bright/20 border border-white/10 text-white text-sm font-medium hover:bg-surface-bright/40 transition-all"
          >
            Questions
          </button>

          <button className="px-4 py-2 rounded-lg bg-cyan-400/10 text-cyan-300 text-sm font-semibold hover:bg-cyan-400/20 transition-all">
            Start AI
          </button>
        </div>
      </div>
    </footer>
  );
}
