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
  const { stream, cameraEnabled: camOn, micEnabled: micOn, toggleCamera, toggleMicro } =
    useMedia();

  const [showSettings, setShowSettings] = useState(false);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);

  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");

  // HOST có thể vào phòng trước — các participant khác phải đợi.
  // - isHost: luôn enable nút (host tự quyết định)
  // - hostJoined: được bật = true nếu host row đã joined_at IS NOT NULL
  const isHost = participantRole === "HOST";
  const [hostJoined, setHostJoined] = useState<boolean>(isHost);

  const fetchHostStatus = useCallback(async () => {
    if (isHost) {
      // Host không cần poll — luôn "đã vào" (vì chính họ quyết định).
      setHostJoined(true);
      return;
    }
    try {
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/status`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data: unknown = await res.json().catch(() => ({}));
      if (
        typeof data === "object" &&
        data !== null &&
        "hostJoined" in data &&
        typeof (data as { hostJoined: unknown }).hostJoined === "boolean"
      ) {
        setHostJoined((data as { hostJoined: boolean }).hostJoined);
      }
    } catch (err) {
      console.error("[waiting] poll status failed:", err);
    }
  }, [meetingCode, isHost]);

  // Poll trạng thái host mỗi 3s — chỉ áp dụng cho non-host.
  useEffect(() => {
    if (isHost) return;
    fetchHostStatus();
    const intervalId = window.setInterval(fetchHostStatus, 3000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchHostStatus, isHost]);

  const canEnter = isHost || hostJoined;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
  }, [stream]);

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
                className={`w-full h-full object-cover transition-opacity ${
                  stream && camOn ? "opacity-100" : "opacity-0"
                }`}
              />

              {(!stream || !camOn) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  {stream ? (
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className="
                          w-28 h-28
                          rounded-full
                          bg-gradient-to-br
                          from-cyan-500
                          to-blue-600
                          flex items-center justify-center
                          shadow-[0_0_30px_rgba(0,240,255,0.3)]
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
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                      <p className="text-xs text-cyan-200">
                        Đang truy cập camera...
                      </p>
                    </div>
                  )}
                </div>
              )}

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
                onClick={() => {
                  if (!canEnter) return;
                  router.push(`/interview/room/${meetingCode}`);
                }}
                disabled={!canEnter}
                aria-disabled={!canEnter}
                className={`
                  relative w-full mt-2
                  font-bold py-3 rounded-lg
                  transition shadow-[0_0_20px_rgba(0,240,255,0.25)]
                  ${
                    canEnter
                      ? "bg-gradient-to-r from-cyan-400 to-blue-400 text-black hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                      : "bg-[#1c2b3c] text-gray-500 cursor-not-allowed shadow-none"
                  }
                `}
              >
                {canEnter
                  ? participantRole === "CANDIDATE"
                    ? "Vào phòng phỏng vấn →"
                    : "Bắt đầu phỏng vấn →"
                  : isHost
                    ? "Đang chờ người tham gia..."
                    : "Đang chờ Host vào phòng..."}
              </button>

              {!canEnter && (
                <div
                  role="status"
                  aria-live="polite"
                  className="
                    flex items-start gap-2
                    px-3 py-2
                    rounded-lg
                    bg-amber-500/10
                    border border-amber-500/30
                    text-amber-200
                    text-xs
                  "
                >
                  <span className="material-symbols-outlined text-base shrink-0 mt-0.5">
                    hourglass_top
                  </span>
                  <span>
                    {isHost
                      ? "Hệ thống đang chờ các thành viên khác sẵn sàng. Bạn có thể vào phòng bất kỳ lúc nào."
                      : "Host chưa vào phòng phỏng vấn. Nút \"Vào phòng phỏng vấn\" sẽ được bật ngay khi Host tham gia."}
                  </span>
                </div>
              )}

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
            type="button"
            onClick={toggleMicro}
            aria-label={micOn ? "Tắt micro" : "Bật micro"}
            aria-pressed={!micOn}
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
            type="button"
            onClick={toggleCamera}
            aria-label={camOn ? "Tắt camera" : "Bật camera"}
            aria-pressed={!camOn}
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
            type="button"
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
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="px-4 py-2 rounded border border-gray-500"
                  >
                    Close
                  </button>

                  <button
                    type="button"
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
