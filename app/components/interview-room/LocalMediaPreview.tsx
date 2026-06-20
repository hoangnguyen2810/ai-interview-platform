"use client";

import { useEffect, useRef } from "react";
import { useMedia } from "./MediaContext";

export interface LocalMediaPreviewProps {
  label: string;
  displayName: string;
}

/**
 * Component chỉ hiển thị — toàn bộ state đọc từ MediaContext.
 * KHÔNG tự gọi getUserMedia.
 */
export default function LocalMediaPreview({
  label,
  displayName,
}: LocalMediaPreviewProps) {
  const { stream, cameraEnabled, mediaError } = useMedia();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
  }, [stream]);

  const hasStream = stream !== null;
  const showVideo = hasStream && cameraEnabled;

  return (
    <div
      className="
        rounded-2xl
        bg-[#0d1c2d]
        border border-[#23384d]
        relative
        overflow-hidden
        flex items-center justify-center
        shadow-lg
        hover:border-cyan-400/40
        transition-all
      "
    >
      {/* ROLE LABEL */}
      <div className="absolute top-3 left-3 text-[10px] uppercase tracking-wider text-cyan-400/70 z-10">
        {label}
      </div>

      {/* STATUS BADGE */}
      <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
        {hasStream ? (
          <>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-green-300">LIVE</span>
          </>
        ) : (
          <span className="text-[10px] text-yellow-300">Đang kết nối...</span>
        )}
      </div>

      {/* VIDEO / PLACEHOLDER */}
      <div className="w-full h-full relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover bg-black ${
            showVideo ? "opacity-100" : "opacity-0"
          } transition-opacity`}
        />

        {!showVideo && !mediaError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
            {!hasStream ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                <p className="text-xs text-cyan-200">Đang truy cập camera...</p>
              </div>
            ) : (
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
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-400">Camera đang tắt</p>
              </div>
            )}
          </div>
        )}

        {mediaError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 px-6 text-center max-w-[260px]">
              <span className="material-symbols-outlined text-red-400 text-3xl">
                videocam_off
              </span>
              <p className="text-xs text-red-300">{mediaError}</p>
            </div>
          </div>
        )}
      </div>

      {/* NAME BADGE */}
      <div
        className="
          absolute bottom-3 left-3
          px-3 py-1.5
          rounded-lg
          bg-black/40
          backdrop-blur-md
          border border-white/10
          z-10
        "
      >
        <span className="text-sm text-white">{displayName}</span>
      </div>
    </div>
  );
}
