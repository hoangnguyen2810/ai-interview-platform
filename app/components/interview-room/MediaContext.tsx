"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Single source of truth cho MediaStream + camera/mic state trong
 * toàn bộ segment /interview/* (Waiting Room + Meeting Room).
 *
 * - Provider mount 1 lần ở app/interview/layout.tsx → state KHÔNG reset khi
 *   navigate giữa waiting ↔ room (cùng segment cha).
 * - getUserMedia() chỉ được gọi duy nhất 1 lần trong đời provider.
 * - Toggle chỉ mutate track.enabled, không tạo stream mới.
 */

export interface MediaContextValue {
  stream: MediaStream | null;
  cameraEnabled: boolean;
  micEnabled: boolean;
  mediaReady: boolean;
  mediaError: string | null;
  toggleCamera: () => void;
  toggleMicro: () => void;
}

const MediaContext = createContext<MediaContextValue | null>(null);

export function MediaProvider({ children }: { children: ReactNode }) {
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setMediaError("Trình duyệt không hỗ trợ getUserMedia");
        return;
      }

      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: true,
          // Audio is intentionally omitted here.
          //
          // Why: the Stream SDK (streamCall.microphone.enable) owns the mic
          // for the actual interview call. If MediaContext also grabs a
          // second audio track, two MediaStreamAudioSourceNodes end up
          // racing for the same physical microphone. Combined with each
          // peer's speakers playing back the other peer's audio, this
          // produced the "echo heard on both candidate + recruiter sides"
          // bug. Keeping the channel pure-video makes MediaContext a
          // preview-only stream.
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        setStream(s);
        setMediaReady(true);
      } catch (err) {
        if (cancelled) return;
        const e = err as DOMException;
        setMediaError(
          e.name === "NotAllowedError"
            ? "Bạn đã từ chối quyền truy cập camera/micro."
            : e.message || "Không thể truy cập camera/micro.",
        );
      }
    }

    start();

    return () => {
      cancelled = true;
      const s = streamRef.current;
      if (s) {
        s.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStream(null);
        setMediaReady(false);
      }
    };
  }, []);

  const toggleCamera = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const next = !cameraEnabled;
    s.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCameraEnabled(next);
  }, [cameraEnabled]);

  const toggleMicro = useCallback(() => {
    // Mic is owned by the Stream SDK's microphone.
    // MediaContext no longer has an audio track to toggle, so we only flip
    // the local boolean state. The real enable/disable happens in:
    //   - InterviewRoomClient.tsx via streamCall.microphone.enable/disable
    //   - FooterControls.tsx via mic.toggle()
    // persisted to sessionStorage so the other page (Waiting ↔ Meeting) sees
    // it via CamMicSyncContext.
    setMicEnabled((prev) => !prev);
  }, []);

  const value = useMemo<MediaContextValue>(
    () => ({
      stream,
      cameraEnabled,
      micEnabled,
      mediaReady,
      mediaError,
      toggleCamera,
      toggleMicro,
    }),
    [stream, cameraEnabled, micEnabled, mediaReady, mediaError, toggleCamera, toggleMicro],
  );

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useMedia(): MediaContextValue {
  const ctx = useContext(MediaContext);
  if (!ctx) {
    throw new Error("useMedia must be used inside <MediaProvider>");
  }
  return ctx;
}
