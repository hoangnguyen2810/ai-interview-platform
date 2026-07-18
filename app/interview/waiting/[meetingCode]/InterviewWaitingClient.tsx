"use client";

import { TopNavBar } from "@/app/components/TopNavBar";
import { useMedia } from "@/app/components/interview-room/MediaContext";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InterviewRole } from "@/lib/interview-guard";

interface Props {
  meetingCode: string;
  title: string;
  participantRole: InterviewRole;
}

export default function InterviewWaitingClient({
  meetingCode,
  title,
  participantRole,
}: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const {
    stream,
    cameraEnabled: camOn,
    micEnabled: micOn,
    toggleCamera,
    toggleMicro,
  } = useMedia();

  const [showSettings, setShowSettings] = useState(false);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");

  useEffect(() => {
    async function loadDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
      setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
    }
    loadDevices();
  }, []);

  const isHost = participantRole === "HOST";
  const [hostJoined, setHostJoined] = useState<boolean>(isHost);

  const SESSION_CAM = "meeting_cam";
  const SESSION_MIC = "meeting_mic";

  const onToggleCamera = () => {
    const next = !camOn;
    toggleCamera();
    sessionStorage.setItem(SESSION_CAM, String(next));
  };

  const onToggleMicro = () => {
    const next = !micOn;
    toggleMicro();
    sessionStorage.setItem(SESSION_MIC, String(next));
  };

  // Poll sessionStorage to reflect cam/mic changes made in meeting room
  useEffect(() => {
    if (!stream) return;
    const pollId = window.setInterval(() => {
      const cam = sessionStorage.getItem(SESSION_CAM);
      const mic = sessionStorage.getItem(SESSION_MIC);
      if (cam === "false" && camOn) {
        toggleCamera();
      } else if (cam === "true" && !camOn) {
        toggleCamera();
      }
      if (mic === "false" && micOn) {
        toggleMicro();
      } else if (mic === "true" && !micOn) {
        toggleMicro();
      }
    }, 1000);
    return () => clearInterval(pollId);
  }, [stream, camOn, micOn, toggleCamera, toggleMicro]);

  // ✅ SAFE stream attach
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream || null;
    }
  }, [stream]);

  // ❌ FIX: cleanup stream đúng lifecycle
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  const fetchHostStatus = useCallback(async () => {
    if (isHost) {
      setHostJoined(true);
      return;
    }

    try {
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/status`,
        { cache: "no-store" },
      );
      if (!res.ok) return;

      const data = await res.json().catch(() => ({}));
      setHostJoined(Boolean(data?.hostJoined));
    } catch (err) {
      console.error("[waiting] poll failed:", err);
    }
  }, [meetingCode, isHost]);

  useEffect(() => {
    if (isHost) return;

    fetchHostStatus();
    const id = window.setInterval(fetchHostStatus, 3000);
    return () => clearInterval(id);
  }, [fetchHostStatus, isHost]);

  const canEnter = isHost || hostJoined;

  return (
    <div className="flex flex-col min-h-screen bg-[#051424] text-[#d4e4fa]">
      <TopNavBar />

      <main className="mt-16 flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* LEFT: CAMERA */}
          <div className="xl:col-span-8">
            <div
              className="
            relative aspect-video rounded-2xl overflow-hidden
            border border-[#2a3b4f]
            bg-[#0a1624]
            shadow-[0_0_30px_rgba(0,240,255,0.05)]
          "
            >
              {/* VIDEO */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  stream && camOn ? "opacity-100" : "opacity-0"
                }`}
              />

              {/* OVERLAY WHEN OFF */}
              {(!stream || !camOn) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  {!stream ? (
                    <>
                      <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                      <p className="text-xs text-cyan-200">
                        Đang kết nối camera...
                      </p>
                    </>
                  ) : (
                    <>
                      <div
                        className="
                      w-28 h-28 rounded-full
                      bg-gradient-to-br from-cyan-500 to-blue-600
                      flex items-center justify-center
                      shadow-[0_0_25px_rgba(0,240,255,0.25)]
                    "
                      >
                        <span className="text-4xl font-bold text-white">
                          {(participantRole === "CANDIDATE"
                            ? "Candidate"
                            : "Interviewer"
                          ).charAt(0)}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400">Camera đang tắt</p>
                    </>
                  )}
                </div>
              )}

              {/* STATUS BADGES */}
              <div className="absolute top-4 left-4 flex gap-2">
                <div className="px-3 py-1.5 bg-black/50 rounded-full flex items-center gap-2 text-xs">
                  <span className="material-symbols-outlined text-cyan-300 text-sm">
                    {micOn ? "mic" : "mic_off"}
                  </span>
                  Mic {micOn ? "Mở" : "Tắt"}
                </div>

                <div className="px-3 py-1.5 bg-black/50 rounded-full flex items-center gap-2 text-xs">
                  <span className="material-symbols-outlined text-cyan-300 text-sm">
                    {camOn ? "videocam" : "videocam_off"}
                  </span>
                  Cam {camOn ? "Mở" : "Tắt"}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: INFO PANEL */}
          <div className="xl:col-span-4">
            <div
              className="
      relative p-8 rounded-3xl
      border border-[#2a3b4f]
      bg-[#0b1622]
      shadow-[0_0_35px_rgba(0,240,255,0.12)]
      overflow-hidden
    "
            >
              {/* glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent pointer-events-none" />

              <div className="relative space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-cyan-200">
                    Sẵn sàng tham gia?
                  </h2>

                  <p className="text-sm text-gray-400 mt-2">
                    Kiểm tra thiết bị trước khi vào phòng phỏng vấn
                  </p>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">
                    Buổi phỏng vấn
                  </div>

                  <div className="font-semibold text-white text-lg">
                    {title}
                  </div>

                  <div
                    className="
            flex items-center justify-between
            bg-[#122131] px-4 py-3 rounded-xl
            border border-[#1c2b3c]
          "
                  >
                    <span className="font-mono text-cyan-200 text-base tracking-wide">
                      {meetingCode}
                    </span>

                    <span
                      className="
            text-xs px-3 py-1 rounded-full
            bg-green-500/10 text-green-400
            border border-green-500/30
          "
                    >
                      LIVE
                    </span>
                  </div>
                </div>

                {/* ENTER BUTTON */}
                <button
                  disabled={!canEnter}
                  onClick={() => router.push(`/interview/room/${meetingCode}`)}
                  className={`
                  w-full mt-2 py-3 rounded-xl font-bold
                  transition-all duration-200

                  ${
                    canEnter
                      ? "bg-gradient-to-r from-cyan-400 to-blue-400 text-black hover:scale-[1.02] active:scale-[0.98]"
                      : "bg-[#1b2a3a] text-gray-500 cursor-not-allowed"
                  }
                `}
                >
                  {canEnter
                    ? participantRole === "CANDIDATE"
                      ? "Vào phòng phỏng vấn →"
                      : "Bắt đầu phỏng vấn →"
                    : isHost
                      ? "Đang chờ người tham gia..."
                      : "Đang chờ Host..."}
                </button>

                {/* WARNING */}
                {!canEnter && (
                  <div
                    className="
                  flex gap-2 items-start
                  text-xs text-amber-200
                  bg-amber-500/10 border border-amber-500/20
                  p-3 rounded-lg
                "
                  >
                    <span className="material-symbols-outlined text-base">
                      hourglass_top
                    </span>

                    <span>
                      {isHost
                        ? "Bạn có thể vào bất kỳ lúc nào."
                        : "Chủ phòng chưa tham gia, vui lòng chờ..."}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="max-w-7xl mx-auto mt-8 flex gap-4">
          <button
            onClick={onToggleMicro}
            className={`
            w-14 h-14 rounded-full flex items-center justify-center
            border transition-all
            ${
              micOn
                ? "bg-[#122131] border-[#3b494b] hover:border-cyan-400"
                : "bg-red-500 border-red-400"
            }
          `}
          >
            <span className="material-symbols-outlined">
              {micOn ? "mic" : "mic_off"}
            </span>
          </button>

          <button
            onClick={onToggleCamera}
            className={`
            w-14 h-14 rounded-full flex items-center justify-center
            border transition-all
            ${
              camOn
                ? "bg-[#122131] border-[#3b494b] hover:border-cyan-400"
                : "bg-red-500 border-red-400"
            }
          `}
          >
            <span className="material-symbols-outlined">
              {camOn ? "videocam" : "videocam_off"}
            </span>
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="
      w-14 h-14 rounded-full flex items-center justify-center
      border bg-[#122131] border-[#3b494b]
      hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]
      transition-all active:scale-95
    "
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
      </main>
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div
            className="
      w-[420px] rounded-2xl
      bg-[#0b1622] border border-[#2a3b4f]
      p-6 space-y-4
      shadow-[0_0_30px_rgba(0,240,255,0.15)]
    "
          >
            <h2 className="text-lg font-bold text-cyan-200">
              Cài đặt thiết bị
            </h2>

            {/* MIC */}
            <div>
              <p className="text-xs text-gray-400 mb-1">Microphone</p>
              <select
                className="w-full p-2 rounded bg-[#122131] border border-[#3b494b]"
                value={selectedMic}
                onChange={(e) => setSelectedMic(e.target.value)}
              >
                {audioInputs.map((mic) => (
                  <option key={mic.deviceId} value={mic.deviceId}>
                    {mic.label || "Microphone"}
                  </option>
                ))}
              </select>
            </div>

            {/* SPEAKER */}
            <div>
              <p className="text-xs text-gray-400 mb-1">Speaker</p>
              <select
                className="w-full p-2 rounded bg-[#122131] border border-[#3b494b]"
                value={selectedSpeaker}
                onChange={(e) => setSelectedSpeaker(e.target.value)}
              >
                {audioOutputs.map((spk) => (
                  <option key={spk.deviceId} value={spk.deviceId}>
                    {spk.label || "Speaker"}
                  </option>
                ))}
              </select>
            </div>

            {/* ACTIONS */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 rounded border border-gray-500 text-gray-300"
              >
                Close
              </button>

              <button
                onClick={() => {
                  console.log("Mic:", selectedMic);
                  console.log("Speaker:", selectedSpeaker);
                  setShowSettings(false);
                }}
                className="
            px-4 py-2 rounded
            bg-cyan-400 text-black font-bold
            hover:scale-[1.02] active:scale-[0.98]
          "
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
