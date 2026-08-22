"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import AIReviewList from "./coding/AIReviewList";
import ReportViewer from "./coding/ReportViewer";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Bumped whenever the recruiter presses "New AI session". Passed to
 * AIReviewList so it can remount and forget any cached submissions/reviews
 * from the previous candidate (since the same meetingCode is reused for
 * multiple candidates in one room).
 */
let reviewReloadCounter = 0;

type Props = {
  open: boolean;
  onClose: () => void;
  meetingCode?: string;
};

type Message = {
  role: "user" | "ai";
  content: string;
  isCVAnalysis?: boolean;
  cvFilename?: string;
};

const AI_BACKEND_URL = "/api";
const SESSION_STORAGE_KEY = "ai_session_id";

function getStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

function setStoredSessionId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(SESSION_STORAGE_KEY, id);
  else localStorage.removeItem(SESSION_STORAGE_KEY);
}

// ─── Small inline icons (no external deps) ───────────────────────────────────
const IconPlus = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconClose = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconPaperclip = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.19 5.19l-9.2 9.19a1.83 1.83 0 0 1-2.59-2.59l8.49-8.48" />
  </svg>
);
const IconSend = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);
const IconMic = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);
const IconMicOff = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="2" x2="22" y1="2" y2="22" />
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
    <path d="M5 10v2a7 7 0 0 0 12 5" />
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

// ─── Voice Input helpers ────────────────────────────────────────────────────────

type VoiceState = "idle" | "recording" | "transcribing";

/** Number of characters to keep from the end of the previous transcript
 *  to detect overlap with the next chunk (3s). */
const OVERLAP_WINDOW = 30;

/** Minimum characters in a transcript to be considered non-noise. */
const MIN_TEXT_LENGTH = 3;

/** Maximum overlap ratio: if a new transcript starts with more than
 *  this fraction of the previous tail, treat it as duplication. */
const MAX_OVERLAP_RATIO = 0.65;

/**
 * Streaming voice input hook.
 *
 * Accuracy improvements over the original:
 *  - Deduplication: overlapping tail of the previous chunk is trimmed
 *    so the same words are not typed twice.
 *  - Silence filter: transcripts shorter than MIN_TEXT_LENGTH are skipped.
 *  - initial_prompt: domain context (CV/JD terms) passed to Whisper.
 *  - Proper field name: "file" (not "audio") matches the backend.
 */
function useVoiceInput(
  onPartial: (text: string) => void,
  initialPrompt: string = "",
) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const sendQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isStreamingRef = useRef(false);
  const prevTailRef = useRef("");

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const transcribeChunk = useCallback(
    async (chunk: Blob): Promise<string> => {
      const form = new FormData();
      form.append("file", chunk, "chunk.webm");
      form.append("language", "vi");
      if (initialPrompt) {
        form.append("initial_prompt", initialPrompt);
      }

      const res = await fetch("/api/speech-to-text", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { detail?: string })?.detail ?? `HTTP ${res.status}`,
        );
      }
      const json = (await res.json()) as { text?: string };
      return (json.text ?? "").trim();
    },
    [initialPrompt],
  );

  /** Strip overlapping prefix from `incoming` using `prevTail` as anchor. */
  const deduplicate = (incoming: string, prevTail: string): string => {
    if (!incoming.length || !prevTail.length) return incoming;
    // Walk backwards from the end of prevTail to find the longest suffix
    // that is also a prefix of incoming (greedy approach).
    for (
      let len = Math.min(prevTail.length, incoming.length);
      len >= 0;
      len--
    ) {
      const tail = prevTail.slice(-len);
      if (incoming.startsWith(tail)) {
        const trimmed = incoming.slice(len).trim();
        if (trimmed) {
          console.log(
            `[voice dedup] stripped ${len} chars overlap: ${JSON.stringify(tail)}`,
          );
        }
        return trimmed;
      }
    }
    return incoming;
  };

  const startRecording = useCallback(async () => {
    setVoiceError(null);
    setVoiceState("recording");
    isStreamingRef.current = true;
    prevTailRef.current = "";

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as DOMException).name;
      if (name === "NotAllowedError") {
        setVoiceError(
          "Không có quyền truy cập microphone. Vui lòng cho phép trong trình duyệt.",
        );
      } else if (name === "NotFoundError") {
        setVoiceError("Không tìm thấy microphone trên thiết bị.");
      } else {
        setVoiceError("Không thể bật microphone.");
      }
      setVoiceState("idle");
      return;
    }

    streamRef.current = stream;
    const allChunks: Blob[] = [];

    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
    });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        allChunks.push(e.data);
        if (isStreamingRef.current) {
          const chunkCopy = e.data;
          sendQueueRef.current = sendQueueRef.current.then(async () => {
            if (!isStreamingRef.current) return;
            try {
              const text = await transcribeChunk(chunkCopy);
              if (text.length < MIN_TEXT_LENGTH) return;
              const prevTail = prevTailRef.current;
              const deduped = deduplicate(text, prevTail);
              prevTailRef.current = text.slice(-OVERLAP_WINDOW);
              if (deduped) {
                console.log(
                  `[voice partial] raw=${JSON.stringify(text)} deduped=${JSON.stringify(deduped)}`,
                );
                onPartial(deduped);
              }
            } catch {
              // silent — partial errors don't interrupt recording
            }
          });
        }
      }
    };

    recorder.onerror = () => {
      setVoiceError("Lỗi ghi âm. Vui lòng thử lại.");
      isStreamingRef.current = false;
      stopTracks();
      setVoiceState("idle");
    };

    recorder.onstop = () => {
      stopTracks();
      setVoiceState("transcribing");
      isStreamingRef.current = false;
    };

    const sendFinal = async () => {
      if (allChunks.length === 0) {
        setVoiceState("idle");
        return;
      }
      const finalBlob = new Blob(allChunks, { type: "audio/webm" });
      try {
        const text = await transcribeChunk(finalBlob);
        if (text.length >= MIN_TEXT_LENGTH) {
          const prevTail = prevTailRef.current;
          const deduped = deduplicate(text, prevTail);
          if (deduped) {
            console.log(
              `[voice final] raw=${JSON.stringify(text)} deduped=${JSON.stringify(deduped)}`,
            );
            onPartial(deduped);
          }
        }
      } catch {
        // final error already shown via voiceError in onstop
      }
      setVoiceState("idle");
    };

    const origOnStop = recorder.onstop;
    recorder.onstop = (ev: Event) => {
      origOnStop?.call(recorder, ev);
      void sendFinal();
    };

    recorder.start(3000);
  }, [stopTracks, transcribeChunk, onPartial]);

  const stopRecording = useCallback(() => {
    isStreamingRef.current = false;
    const rec = recorderRef.current;
    if (!rec) return;
    try {
      rec.requestData();
    } catch {
      /* flush */
    }
    rec.stop();
    recorderRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      isStreamingRef.current = false;
      recorderRef.current?.stop();
      stopTracks();
    };
  }, [stopTracks]);

  return {
    voiceState,
    voiceError,
    setVoiceError,
    startRecording,
    stopRecording,
  };
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function AIDrawer({ open, onClose, meetingCode }: Props) {
  const [tab, setTab] = useState<"chat" | "review">("chat");
  const [reportOpen, setReportOpen] = useState(false);
  const [reviewReloadKey, setReviewReloadKey] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvDragging, setCvDragging] = useState(false);
  const [cvFilename, setCvFilename] = useState<string | null>(null);
  const [cvContext, setCvContext] = useState<string>("");
  // Đặt gần đầu file, cạnh các Icon component
  const markdownComponents = {
    h1: ({ children }: any) => (
      <h1 className="text-[15px] font-semibold mt-2 mb-1 first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-[14px] font-semibold mt-2 mb-1 first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-[13.5px] font-semibold mt-2 mb-1 first:mt-0">
        {children}
      </h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-[13px] font-semibold mt-1.5 mb-0.5 first:mt-0">
        {children}
      </h4>
    ),
    p: ({ children }: any) => (
      <p className="my-1 first:mt-0 last:mb-0">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="my-1 pl-4 list-disc space-y-0.5">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="my-1 pl-4 list-decimal space-y-0.5">{children}</ol>
    ),
    li: ({ children }: any) => <li className="leading-snug">{children}</li>,
    code: ({ inline, children, ...props }: any) =>
      inline ? (
        <code
          className="px-1 py-0.5 rounded bg-[#2a2a2a] text-[12px]"
          {...props}
        >
          {children}
        </code>
      ) : (
        <code className="block" {...props}>
          {children}
        </code>
      ),
    pre: ({ children }: any) => (
      <pre className="my-1.5 p-2 rounded bg-[#111] overflow-x-auto text-[12px]">
        {children}
      </pre>
    ),
    strong: ({ children }: any) => (
      <strong className="font-semibold">{children}</strong>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="my-1 pl-2 border-l-2 border-[#3b82f6]/50 italic">
        {children}
      </blockquote>
    ),
  };

  // Voice input: feed partial transcripts directly into the input textarea
  const {
    voiceState,
    voiceError,
    setVoiceError,
    startRecording,
    stopRecording,
  } = useVoiceInput(
    (partial) =>
      setInput((prev) => (prev ? `${prev} ${partial}` : partial).trim()),
    cvContext,
  );

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Session lifecycle ─────────────────────────────────────────────────────
  const ensureSession = useCallback(async (): Promise<string> => {
    const existing = sessionIdRef.current ?? getStoredSessionId();
    if (existing) {
      try {
        const r = await fetch(`${AI_BACKEND_URL}/sessions/${existing}`, {
          method: "GET",
        });
        if (r.ok) {
          sessionIdRef.current = existing;
          setSessionId(existing);
          setSessionReady(true);
          return existing;
        }
      } catch {
        // fall through
      }
    }
    const res = await fetch(`${AI_BACKEND_URL}/sessions`, { method: "POST" });
    if (!res.ok) throw new Error("Cannot create session");
    const data = await res.json();
    sessionIdRef.current = data.session_id;
    setSessionId(data.session_id);
    setStoredSessionId(data.session_id);
    setSessionReady(true);
    return data.session_id;
  }, []);

  const resetSession = useCallback(async () => {
    const current = sessionIdRef.current;
    if (current) {
      try {
        await fetch(`${AI_BACKEND_URL}/sessions/${current}`, {
          method: "DELETE",
        });
      } catch {
        // ignore
      }
    }
    setStoredSessionId(null);
    setMessages([]);
    setCvFilename(null);
    sessionIdRef.current = null;
    setSessionId(null);
    setSessionReady(false);
    // Force AIReviewList to remount so it drops cached submissions/reviews
    // from the previous candidate in this same room.
    reviewReloadCounter += 1;
    setReviewReloadKey(reviewReloadCounter);
    await ensureSession();
  }, [ensureSession]);

  // Reset everything when meetingCode changes (recruiter moves to a different interview).
  useEffect(() => {
    if (!meetingCode) return;
    // Clear AI session and messages so each candidate gets isolated context.
    const clear = async () => {
      const current = sessionIdRef.current;
      if (current) {
        try {
          await fetch(`${AI_BACKEND_URL}/sessions/${current}`, {
            method: "DELETE",
          });
        } catch {
          // ignore
        }
      }
      setStoredSessionId(null);
      setMessages([]);
      setCvFilename(null);
      setCvContext("");
      sessionIdRef.current = null;
      setSessionId(null);
      setSessionReady(false);
    };
    void clear();
  }, [meetingCode]);

  useEffect(() => {
    if (open && !sessionReady) {
      ensureSession().catch((e) =>
        console.error("Failed to create session", e),
      );
    }
  }, [open, sessionReady, ensureSession]);

  // ─── Send chat message ────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    let sid = sessionIdRef.current;
    if (!sid) {
      try {
        sid = await ensureSession();
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "ai", content: "Không thể tạo session. Vui lòng thử lại." },
        ]);
        return;
      }
    }

    const userMessage = input;
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${AI_BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid, message: userMessage }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: data.reply || "No response" },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: `Lỗi: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ─── Voice input handler ─────────────────────────────────────────────────
  const handleVoiceClick = () => {
    if (voiceState === "recording") {
      stopRecording();
      // Input is already being filled by partial transcripts.
      // User manually sends with Enter or the send button.
      return;
    }
    if (voiceState !== "idle") return;
    void startRecording();
  };

  // ─── Upload & analyze CV ─────────────────────────────────────────────────
  const uploadCV = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            content:
              "Chỉ hỗ trợ file PDF. Vui lòng chọn file có định dạng .pdf",
            isCVAnalysis: false,
          },
        ]);
        return;
      }

      let sid = sessionIdRef.current;
      if (!sid) {
        try {
          sid = await ensureSession();
        } catch {
          setMessages((prev) => [
            ...prev,
            { role: "ai", content: "Không thể tạo session để upload CV." },
          ]);
          return;
        }
      }

      setCvUploading(true);
      setCvFile(file);

      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: `Đã gửi file: ${file.name}`,
          isCVAnalysis: false,
        },
      ]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("session_id", sid);

        const res = await fetch(`${AI_BACKEND_URL}/cv/upload`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `HTTP ${res.status}`);
        }

        const data = await res.json();

        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            content: `Phân tích CV: ${file.name}\n\n${data.analysis}`,
            isCVAnalysis: true,
            cvFilename: file.name,
          },
        ]);

        setCvFilename(file.name);

        // Refresh CV context so voice input can use it for initial_prompt
        if (sid) {
          try {
            const ctxRes = await fetch(
              `${AI_BACKEND_URL}/sessions/${sid}/cv-context`,
            );
            if (ctxRes.ok) {
              const ctxData = await ctxRes.json();
              setCvContext(ctxData.prompt ?? "");
            }
          } catch {
            // non-critical — voice will just use no context
          }
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            content: `Lỗi khi phân tích CV: ${err instanceof Error ? err.message : String(err)}`,
            isCVAnalysis: true,
            cvFilename: file.name,
          },
        ]);
      } finally {
        setCvUploading(false);
        setCvFile(null);
      }
    },
    [ensureSession],
  );

  // ─── File input handlers ──────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadCV(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setCvDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setCvDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCvDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadCV(file);
  };

  // ─── Render helpers ──────────────────────────────────────────────────────
  const messagesList = messages;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // ─── Drag-to-move (kéo thả cả drawer) ─────────────────────────────────────
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Không kéo nếu đang bấm vào nút (đóng, +, report...)
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    draggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    offsetStartRef.current = { ...dragOffset };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setDragOffset({
        x: offsetStartRef.current.x + dx,
        y: offsetStartRef.current.y + dy,
      });
    };
    const handleMouseUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesList.length]);

  const isVoiceBusy = voiceState !== "idle";

  if (!open) return null;

  return (
    <div
      className="fixed inset-y-0 right-0 w-[600px] bg-[#181818] shadow-2xl z-50 flex flex-col border-l border-[#2a2a2a] font-sans text-[13px]"
      style={{
        transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
      }}
    >
      {/* Header */}
      <div
        onMouseDown={handleHeaderMouseDown}
        className="flex items-center justify-between px-3 h-11 border-b border-[#2a2a2a] bg-[#181818] shrink-0 cursor-move select-none"
      >
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6] shrink-0" />
          <div className="min-w-0">
            <h3 className="font-medium text-[#e4e4e4] text-[12.5px] leading-tight truncate">
              Trợ lý ảo hỗ trợ phỏng vấn
            </h3>
            <p className="text-[11px] text-[#6e6e6e] truncate leading-tight">
              {cvFilename ? cvFilename : "Chưa tải CV"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setReportOpen(true)}
            title="Tổng hợp báo cáo AI"
            className="flex items-center justify-center h-6 px-2 rounded text-[#9a9a9a] hover:bg-[#2a2a2a] hover:text-cyan-400 transition-colors text-[11px] gap-1"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </button>
          <button
            onClick={resetSession}
            title="Bắt đầu session mới"
            className="flex items-center justify-center h-6 w-6 rounded text-[#9a9a9a] hover:bg-[#2a2a2a] hover:text-[#e4e4e4] transition-colors"
          >
            <IconPlus />
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center h-6 w-6 rounded text-[#9a9a9a] hover:bg-[#2a2a2a] hover:text-[#e4e4e4] transition-colors"
          >
            <IconClose />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2a2a2a] shrink-0">
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 py-2 text-[12px] transition-colors ${
            tab === "chat"
              ? "text-[#e4e4e4] border-b-2 border-[#3b82f6]"
              : "text-[#6e6e6e] border-b-2 border-transparent hover:text-[#9a9a9a]"
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setTab("review")}
          className={`flex-1 py-2 text-[12px] transition-colors ${
            tab === "review"
              ? "text-[#e4e4e4] border-b-2 border-[#3b82f6]"
              : "text-[#6e6e6e] border-b-2 border-transparent hover:text-[#9a9a9a]"
          }`}
        >
          Đánh giá Code
        </button>
      </div>

      {/* Body */}
      {tab === "chat" ? (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-3 bg-[#181818]">
            {messagesList.length === 0 && (
              <div className="text-center text-[12.5px] text-[#6e6e6e] mt-16 px-4">
                <p className="mb-1.5 text-[#9a9a9a]">Xin chào</p>
                <p>Tải lên CV hoặc hỏi bất kỳ câu hỏi nào về phỏng vấn IT.</p>
              </div>
            )}
            {messagesList.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "user" ? (
                  <div className="max-w-[85%] px-3 py-2 rounded-md text-[13px] leading-relaxed break-words bg-[#2a2d3a] text-[#e4e4e4] border border-[#343850]">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div
                    className={`max-w-[88%] px-3 py-2 rounded-md text-[13px] leading-relaxed break-words border-l-2 ${
                      m.isCVAnalysis
                        ? "bg-[#221c12] border-[#b8860b] text-[#e4e4e4]"
                        : "bg-[#1f1f1f] border-[#3b82f6] text-[#dcdcdc]"
                    }`}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#1f1f1f] border-l-2 border-[#3b82f6] px-3 py-2 rounded-md text-[13px] text-[#8a8a8a]">
                  <span className="inline-flex gap-1 items-center">
                    <span className="h-1 w-1 rounded-full bg-[#8a8a8a] animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1 w-1 rounded-full bg-[#8a8a8a] animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1 w-1 rounded-full bg-[#8a8a8a] animate-bounce" />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice error */}
          {voiceError && (
            <div className="mx-3 mb-2 px-3 py-2 rounded bg-red-900/40 border border-red-800 text-[11px] text-red-300">
              {voiceError}
              <button
                className="ml-2 underline"
                onClick={() => setVoiceError(null)}
              >
                Đóng
              </button>
            </div>
          )}

          {/* Composer */}
          <div className="px-3 pb-3 pt-2 border-t border-[#2a2a2a] bg-[#181818] shrink-0">
            <div
              className={`rounded-lg border transition-colors ${
                cvDragging
                  ? "border-[#3b82f6] bg-[#1a2030]"
                  : "border-[#2f2f2f] bg-[#1f1f1f] focus-within:border-[#3f3f3f]"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Transcription status banner */}
              {voiceState === "recording" && (
                <div className="flex items-center gap-1.5 px-3 pt-2 text-[11px] text-red-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                  Ghi âm...
                </div>
              )}
              {voiceState === "transcribing" && (
                <div className="flex items-center gap-1.5 px-3 pt-2 text-[11px] text-yellow-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  Đang biên dịch...
                </div>
              )}

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={
                  cvDragging ? "Thả file PDF vào đây..." : "Hỏi gì đó..."
                }
                disabled={loading}
                rows={2}
                className="w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-[13px] text-[#e4e4e4] placeholder-[#6e6e6e] focus:outline-none disabled:opacity-50"
              />
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <div className="flex items-center gap-1">
                  {/* Upload CV */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={cvUploading}
                    title="Tải CV (PDF)"
                    className="flex items-center gap-1 text-[11.5px] px-2 py-1 rounded text-[#9a9a9a] hover:bg-[#2a2a2a] hover:text-[#e4e4e4] disabled:opacity-50 transition-colors"
                  >
                    {cvUploading ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-[#b8860b] animate-pulse" />
                        Đang tải...
                      </>
                    ) : (
                      <>
                        <IconPaperclip />
                        CV.pdf
                      </>
                    )}
                  </button>

                  {/* Voice input */}
                  <button
                    onClick={handleVoiceClick}
                    disabled={voiceState === "transcribing"}
                    title={
                      voiceState === "recording"
                        ? "Dừng ghi âm"
                        : voiceState === "transcribing"
                          ? "Đang nhận dạng..."
                          : "Ghi âm bằng giọng nói"
                    }
                    className={`flex items-center gap-1 text-[11.5px] px-2 py-1 rounded transition-colors disabled:cursor-not-allowed ${
                      voiceState === "recording"
                        ? "text-red-400 bg-red-900/30 hover:bg-red-900/50"
                        : "text-[#9a9a9a] hover:bg-[#2a2a2a] hover:text-[#e4e4e4] disabled:opacity-40"
                    }`}
                  >
                    {voiceState === "recording" ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                        Stop
                      </>
                    ) : voiceState === "transcribing" ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                        ...
                      </>
                    ) : (
                      <>
                        <IconMic />
                        Mic
                      </>
                    )}
                  </button>
                </div>

                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  title="Gửi"
                  className="flex items-center justify-center h-6 w-6 rounded-md bg-[#3b82f6] text-white disabled:bg-[#2a2a2a] disabled:text-[#5a5a5a] hover:bg-[#2f6fe0] disabled:cursor-not-allowed transition-colors"
                >
                  <IconSend />
                </button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </>
      ) : meetingCode ? (
        <div className="flex-1 min-h-0 bg-[#181818]" key={reviewReloadKey}>
          <AIReviewList meetingCode={meetingCode} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[11.5px] text-[#6e6e6e] p-4 text-center">
          Không tìm thấy meetingCode.
        </div>
      )}

      {/* Report viewer modal — rendered inside the guard so button is accessible */}
      {meetingCode && reportOpen && (
        <ReportViewer
          meetingCode={meetingCode}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
