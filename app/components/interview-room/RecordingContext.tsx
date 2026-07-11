"use client";

// RecordingContext
// -----------------
// Quản lý vòng đời của GetStream Call Recording phía client:
//  - Tự động start recording sau khi join (nếu enableRecording = true)
//  - Tự động stop recording khi user rời phòng / unload tab
//  - Đảm bảo chỉ start 1 lần, không gọi start khi đã recording
//  - Lắng nghe event từ SDK để đồng bộ state với server
//  - Khi nhận `call.recording_ready` → gọi API lưu metadata vào DB
//
// Lưu ý: SDK GetStream Video yêu cầu tài khoản enable "Call Recording".
// Nếu tài khoản chưa bật, startRecording() sẽ throw — ta log warning rõ ràng
// và KHÔNG break flow của call.

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
import type { Call } from "@stream-io/video-react-sdk";

export type RecordingStatus =
  | "idle"
  | "starting"
  | "recording"
  | "stopping"
  | "stopped"
  | "error";

interface ReadyRecordingInfo {
  url?: string;
  filename?: string;
  mimeType?: string;
  durationSeconds?: number;
  sizeBytes?: number;
}

interface RecordingContextValue {
  /** Server config: interview có enable recording không */
  enabled: boolean;
  /** Trạng thái recording hiện tại */
  status: RecordingStatus;
  /** Lỗi gần nhất (nếu có) — null khi OK */
  error: string | null;
  /** Bắt đầu recording (idempotent — không gọi lại nếu đang chạy) */
  start: () => Promise<void>;
  /** Dừng recording (idempotent — không gọi nếu chưa chạy) */
  stop: () => Promise<void>;
  /**
   * Chủ động gọi API server để sync recordings từ GetStream về DB.
   * Dùng khi: end call, user rời phòng, hoặc sau khi stop recording
   * để chắc chắn DB có row (kể cả khi webhook không được cấu hình).
   */
  syncRecordings: () => Promise<{ synced: number }>;
  /** Đang đồng bộ recording metadata từ Stream */
  isSyncing: boolean;
}

const RecordingContext = createContext<RecordingContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  call: Call | null;
  /** Cờ server báo buổi phỏng vấn có enable recording */
  enabled: boolean;
  /**
   * Cờ đánh dấu user hiện tại là HOST (hoặc CO_HOST/INTERVIEWER) — người sở
   * hữu vòng đời của recording. Auto-stop trong beforeunload / unmount chỉ
   * được phép chạy khi `isHost=true`. Nếu false (candidate), recording sẽ
   * được host chủ động stop qua FooterControls → POST /api/.../end.
   */
  isHost?: boolean;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

export function RecordingProvider({
  children,
  call,
  enabled,
  isHost = false,
}: ProviderProps) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // ref chống double-start trong cùng 1 tick
  const inFlightStartRef = useRef(false);
  const inFlightStopRef = useRef(false);
  // ref đánh dấu đã attempt autoStart cho call hiện tại
  const autoStartedRef = useRef(false);
  // ref đánh dấu tab đang đóng → cần stop ngay
  const stoppingRef = useRef(false);

  const start = useCallback(async () => {
    if (!call) {
      console.warn("[recording] start ignored: call is null");
      return;
    }
    if (!enabled) {
      console.warn(
        "[recording] start ignored: recording is not enabled for this interview",
      );
      return;
    }
    if (status === "recording" || status === "starting") {
      console.log("[recording] start ignored: already running", { status });
      return;
    }
    if (inFlightStartRef.current) return;

    inFlightStartRef.current = true;
    setError(null);
    setStatus("starting");
    try {
      await call.startRecording();
      // State sẽ được cập nhật qua event listener `call.recording_started`
      // nhưng set luôn để UI phản hồi nhanh.
      setStatus("recording");
      console.log("[recording] startRecording() resolved successfully");
    } catch (err) {
      const msg = getErrorMessage(err);
      const lower = msg.toLowerCase();
      const isAlreadyRecording =
        lower.includes("already") || lower.includes("recording");
      const isNotEnabled =
        lower.includes("not enabled") ||
        lower.includes("permission") ||
        lower.includes("forbidden") ||
        lower.includes("401") ||
        lower.includes("403");

      if (isAlreadyRecording) {
        console.warn(
          "[recording] start: server reports already recording — syncing state",
          msg,
        );
        setStatus("recording");
      } else {
        if (isNotEnabled) {
          console.warn(
            "[recording] Account chưa enable Call Recording trên GetStream. " +
              "Vào Stream Dashboard → Calls → Recording để bật. Skipping recording.",
            msg,
          );
        } else {
          console.error("[recording] startRecording() failed:", err);
        }
        setError(msg);
        setStatus("error");
      }
    } finally {
      inFlightStartRef.current = false;
    }
  }, [call, enabled, status]);

  const stop = useCallback(async () => {
    if (!call) {
      console.warn("[recording] stop ignored: call is null");
      return;
    }
    if (status === "idle" || status === "stopped" || status === "stopping") {
      console.log("[recording] stop ignored: not recording", { status });
      return;
    }
    if (inFlightStopRef.current) return;

    inFlightStopRef.current = true;
    setStatus("stopping");
    try {
      await call.stopRecording();
      setStatus("stopped");
      console.log("[recording] stopRecording() resolved successfully");
    } catch (err) {
      const msg = getErrorMessage(err);
      const lower = msg.toLowerCase();
      const notRecording =
        lower.includes("not recording") || lower.includes("not currently");

      if (notRecording) {
        console.warn(
          "[recording] stop: server reports not recording — syncing state",
          msg,
        );
        setStatus("stopped");
      } else {
        console.error("[recording] stopRecording() failed:", err);
        setError(msg);
        setStatus("error");
      }
    } finally {
      inFlightStopRef.current = false;
    }
  }, [call, status]);

  const [isSyncing, setIsSyncing] = useState(false);

  const syncRecordings = useCallback(async (): Promise<{ synced: number }> => {
    if (!call) {
      console.warn("[recording] syncRecordings ignored: call is null");
      return { synced: 0 };
    }
    const meetingCode = call.id;
    if (!meetingCode) return { synced: 0 };

    if (isSyncing) {
      console.log("[recording] syncRecordings already in progress, skip");
      return { synced: 0 };
    }

    setIsSyncing(true);
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("token")
          : null;
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/recordings`,
        {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ forceSync: true }),
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `syncRecordings failed (${res.status}): ${text.slice(0, 200)}`,
        );
      }

      const json = (await res.json().catch(() => ({}))) as {
        synced?: number;
      };
      const synced = typeof json.synced === "number" ? json.synced : 0;
      console.log("[recording] syncRecordings done, synced=", synced);
      return { synced };
    } catch (err) {
      console.warn("[recording] syncRecordings error:", err);
      return { synced: 0 };
    } finally {
      setIsSyncing(false);
    }
  }, [call, isSyncing]);

  // Sync SDK events → state. Lắng nghe cả khi `enabled=false` để nếu call
  // đã được start từ tab khác thì UI vẫn hiển thị đúng.
  useEffect(() => {
    if (!call) return;

    const onStarted = () => {
      console.log("[recording] SDK event: call.recording_started");
      setStatus("recording");
      setError(null);
    };
    const onStopped = () => {
      console.log("[recording] SDK event: call.recording_stopped");
      setStatus("stopped");
    };
    const onFailed = (event: unknown) => {
      console.warn("[recording] SDK event: call.recording_failed", event);
      const reason =
        event && typeof event === "object" && "reason" in event
          ? String((event as { reason?: unknown }).reason ?? "")
          : "";
      setError(reason || "Recording failed");
      setStatus("error");
    };
    const onReady = (event: unknown) => {
      console.log("[recording] SDK event: call.recording_ready", event);
      // Lưu metadata vào DB ngay khi file ready để hiển thị ở /recruiter/recordings.
      const info = extractReadyInfo(event);
      void persistReadyRecording(call, info).catch((err) => {
        console.warn("[recording] persist metadata failed:", err);
      });
    };

    call.on("call.recording_started", onStarted);
    call.on("call.recording_stopped", onStopped);
    call.on("call.recording_failed", onFailed);
    call.on("call.recording_ready", onReady);

    return () => {
      call.off("call.recording_started", onStarted);
      call.off("call.recording_stopped", onStopped);
      call.off("call.recording_failed", onFailed);
      call.off("call.recording_ready", onReady);
    };
  }, [call]);

  // Auto-start recording khi call đã join xong và được enable.
  // Chỉ attempt 1 lần cho mỗi call instance.
  useEffect(() => {
    if (!call || !enabled) return;
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;

    // Đợi 1 nhịp để SDK ổn định state sau join() trước khi start.
    const timer = window.setTimeout(() => {
      void start();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [call, enabled, start]);

  // Auto-stop khi tab đóng hoặc user rời trang.
  // CHỈ HOST mới stop trong beforeunload — candidate rời tab/close browser
  // không được stop recording của host (host mới là người sở hữu phiên ghi hình).
  useEffect(() => {
    if (!call || !enabled) return;
    if (!isHost) return;

    const handleBeforeUnload = () => {
      if (stoppingRef.current) return;
      stoppingRef.current = true;
      // Best-effort fire-and-forget; không thể await trong beforeunload.
      try {
        void call.stopRecording();
      } catch (err) {
        console.warn("[recording] stop on unload error:", err);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [call, enabled, isHost]);

  // Auto-stop khi Provider unmount (ví dụ user navigate sang /dashboard
  // hoặc component InterviewRoomClient cleanup). CHỈ HOST mới stop ở đây —
  // candidate redirect về /candidate/dashboard sẽ unmount provider nhưng
  // không được stop recording (host quyết định khi nào kết thúc).
  useEffect(() => {
    return () => {
      if (!call) return;
      if (!isHost) return;
      const c = call;
      // Đọc state.recording (boolean) để biết có đang recording không.
      let isRecording = false;
      try {
        const state = (c as unknown as { state?: { recording?: boolean } })
          .state;
        isRecording = Boolean(state?.recording);
      } catch {
        // ignore
      }
      if (!isRecording) return;
      try {
        void c.stopRecording();
      } catch (err) {
        console.warn("[recording] stop on unmount error:", err);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call]);

  const value = useMemo<RecordingContextValue>(
    () => ({
      enabled,
      status,
      error,
      start,
      stop,
      syncRecordings,
      isSyncing,
    }),
    [enabled, status, error, start, stop, syncRecordings, isSyncing],
  );

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecording(): RecordingContextValue {
  const ctx = useContext(RecordingContext);
  if (!ctx) {
    throw new Error("useRecording must be used inside <RecordingProvider>");
  }
  return ctx;
}

/**
 * Trích thông tin recording từ event payload của GetStream SDK.
 * Tùy phiên bản SDK, payload có thể nằm trong `event.call_recording` hoặc
 * trực tiếp trên event. Hàm này cố gắng đọc cả 2 dạng.
 */
function extractReadyInfo(event: unknown): ReadyRecordingInfo {
  if (!event || typeof event !== "object") return {};
  const ev = event as Record<string, unknown>;
  const out: ReadyRecordingInfo = {};

  // Một số SDK versions wrap bên trong call_recording
  const inner = ev.call_recording;
  if (inner && typeof inner === "object") {
    const rec = inner as Record<string, unknown>;
    if (typeof rec.url === "string") out.url = rec.url;
    if (typeof rec.filename === "string") out.filename = rec.filename;
    if (typeof rec.mime_type === "string") out.mimeType = rec.mime_type;
    if (typeof rec.duration === "number") out.durationSeconds = rec.duration;
    if (typeof rec.size === "number") out.sizeBytes = rec.size;
  }
  // Flat shape fallback
  if (!out.url && typeof ev.url === "string") out.url = ev.url;
  if (!out.filename && typeof ev.filename === "string")
    out.filename = ev.filename;
  if (!out.mimeType && typeof ev.mime_type === "string")
    out.mimeType = ev.mime_type;
  if (out.durationSeconds == null && typeof ev.duration === "number")
    out.durationSeconds = ev.duration;

  return out;
}

async function persistReadyRecording(
  call: Call,
  info: ReadyRecordingInfo,
): Promise<void> {
  const url = info.url;
  if (!url) {
    console.warn(
      "[recording] recording_ready event không có URL, bỏ qua persist",
      info,
    );
    return;
  }

  const meetingCode = call.id; // call.id = meetingCode (xem InterviewRoomClient)
  if (!meetingCode) {
    console.warn("[recording] missing meeting code, skip persist");
    return;
  }

  const payload = {
    fileName: info.filename ?? undefined,
    fileUrl: url,
    mimeType: info.mimeType ?? "video/webm",
    durationSeconds: info.durationSeconds ?? 0,
    sizeBytes: info.sizeBytes ?? 0,
  };

  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(
    `/api/interviews/${encodeURIComponent(meetingCode)}/recordings`,
    {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `POST recordings failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }

  const json = await res.json().catch(() => null);
  console.log("[recording] metadata persisted:", json);
}
