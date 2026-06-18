"use client";

import { TopNavBar } from "@/app/components/TopNavBar";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);

  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");

  useEffect(() => {
    async function startMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Cannot access camera/mic:", err);
      }
    }

    startMedia();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleMic = () => {
    const stream = streamRef.current;
    if (!stream) return;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !micOn;
    });

    setMicOn(!micOn);
  };

  const toggleCam = () => {
    const stream = streamRef.current;
    if (!stream) return;

    stream.getVideoTracks().forEach((track) => {
      track.enabled = !camOn;
    });

    setCamOn(!camOn);
  };

  useEffect(() => {
    async function loadDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices();

      setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
      setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
    }

    loadDevices();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#051424] text-[#d4e4fa]">
      <TopNavBar />

      <main className="mt-16 flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* CAMERA */}
          <div className="xl:col-span-8">
            <div className="relative aspect-video rounded-xl overflow-hidden border border-[#3b494b] bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              <div className="absolute top-4 left-4 flex gap-2">
                <div className="px-3 py-1.5 bg-black/60 rounded-full flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-300">
                    {micOn ? "mic" : "mic_off"}
                  </span>
                  Mic {micOn ? "On" : "Off"}
                </div>

                <div className="px-3 py-1.5 bg-black/60 rounded-full flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-300">
                    {camOn ? "videocam" : "videocam_off"}
                  </span>
                  Cam {camOn ? "On" : "Off"}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="xl:col-span-4">
            <div className="relative p-6 rounded-xl border border-[#3b494b] bg-[#0d1c2d] flex flex-col gap-5 shadow-[0_0_25px_rgba(0,240,255,0.08)] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent pointer-events-none" />

              <div className="relative">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <h2 className="text-xl font-bold text-cyan-200">
                    Sẵn sàng tham gia?
                  </h2>
                </div>

                <p className="text-sm text-gray-400 mt-1">
                  Kiểm tra thiết bị trước khi bắt đầu.
                </p>
              </div>

              <div className="relative space-y-3 text-sm border-t border-[#1c2b3c] pt-4">
                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs uppercase tracking-wider">
                    Buổi phỏng vấn
                  </span>
                  <span className="text-white font-semibold text-base">
                    {title}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-[#122131] px-3 py-2 rounded-lg border border-[#1c2b3c]">
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-xs">Phòng</span>
                    <span className="text-cyan-200 font-mono tracking-widest">
                      {meetingCode}
                    </span>
                  </div>

                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/30">
                    LIVE
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push(`/interview/room/${meetingCode}`)}
                className="relative w-full mt-2 bg-gradient-to-r from-cyan-400 to-blue-400 text-black font-bold py-3 rounded-lg hover:scale-[1.02] active:scale-[0.98] transition shadow-[0_0_20px_rgba(0,240,255,0.25)]"
              >
                {participantRole === "CANDIDATE"
                  ? "Vào phòng phỏng vấn →"
                  : "Bắt đầu phỏng vấn →"}
              </button>

              <p className="text-xs text-gray-500 text-center">
                Hệ thống đã sẵn sàng kết nối bạn với{" "}
                {participantRole === "CANDIDATE" ? "interviewer" : "ứng viên"}
              </p>
            </div>
          </div>
        </div>

        {/* CONTROL */}
        <div className="max-w-7xl mx-auto mt-8 flex gap-4 ">
          <button
            onClick={toggleMic}
            className={`w-14 h-14 rounded-full flex items-center justify-center border cursor-pointer transition-all duration-200
  ${
    micOn
      ? "bg-[#122131] border-[#3b494b] hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]"
      : "bg-red-500 border-red-400 hover:border-red-300 hover:shadow-[0_0_12px_rgba(255,0,0,0.4)]"
  }`}
          >
            <span className="material-symbols-outlined">
              {micOn ? "mic" : "mic_off"}
            </span>
          </button>

          <button
            onClick={toggleCam}
            className={`w-14 h-14 rounded-full flex items-center justify-center border cursor-pointer transition-all duration-200
  ${
    camOn
      ? "bg-[#122131] border-[#3b494b] hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]"
      : "bg-red-500 border-red-400 hover:border-red-300 hover:shadow-[0_0_12px_rgba(255,0,0,0.4)]"
  }`}
          >
            <span className="material-symbols-outlined">
              {camOn ? "videocam" : "videocam_off"}
            </span>
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="w-14 h-14 rounded-full flex items-center justify-center border cursor-pointer transition-all duration-200
  bg-[#122131] border-[#3b494b]
  hover:border-cyan-400
  hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]
  active:scale-95"
          >
            <span className="material-symbols-outlined ">settings</span>
          </button>
          {showSettings && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-[#0d1c2d] border border-[#3b494b] rounded-xl p-6 w-[400px] flex flex-col gap-4">
                <h2 className="text-lg font-bold text-cyan-200">
                  Device Settings
                </h2>

                <div>
                  <p className="text-sm text-gray-400 mb-1">Microphone</p>
                  <select
                    className="w-full p-2 bg-[#122131] border border-[#3b494b] rounded"
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

                <div>
                  <p className="text-sm text-gray-400 mb-1">Speaker</p>
                  <select
                    className="w-full p-2 bg-[#122131] border border-[#3b494b] rounded"
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

                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-4 py-2 rounded border border-gray-500"
                  >
                    Close
                  </button>

                  <button
                    onClick={() => {
                      console.log("Mic:", selectedMic);
                      console.log("Speaker:", selectedSpeaker);
                      setShowSettings(false);
                    }}
                    className="px-4 py-2 rounded bg-cyan-400 text-black font-bold"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
