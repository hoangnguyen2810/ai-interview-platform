"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
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
const IconFile = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

export default function AIDrawer({ open, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvDragging, setCvDragging] = useState(false);
  const [cvFilename, setCvFilename] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Session lifecycle ────────────────────────────────────────────────────
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
        // fall through to creating a new one
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

  // Reset (start a brand-new session, like a new chat thread)
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
    await ensureSession();
  }, [ensureSession]);

  // Ensure a session exists when the drawer opens
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

  // ─── Upload & analyze CV ────────────────────────────────────────────────────
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
          content: `📄 Đã gửi file: **${file.name}**`,
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
            content: `📋 **Phân tích CV: ${file.name}**\n\n${data.analysis}`,
            isCVAnalysis: true,
            cvFilename: file.name,
          },
        ]);

        setCvFilename(file.name);
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

  // ─── File input handlers ────────────────────────────────────────────────────
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

  // ─── Render ────────────────────────────────────────────────────────────────
  const messagesList = messages;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesList.length]);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-[#181818] shadow-2xl z-50 flex flex-col border-l border-[#2a2a2a] font-sans text-[13px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-11 border-b border-[#2a2a2a] bg-[#181818] shrink-0">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6] shrink-0" />
          <div className="min-w-0">
            <h3 className="font-medium text-[#e4e4e4] text-[12.5px] leading-tight truncate">
              AI Interview Assistant
            </h3>
            <p className="text-[11px] text-[#6e6e6e] truncate leading-tight">
              {cvFilename ? cvFilename : "Chưa upload CV"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-[#181818]">
        {messagesList.length === 0 && (
          <div className="text-center text-[12.5px] text-[#6e6e6e] mt-16 px-4">
            <p className="mb-1.5 text-[#9a9a9a]">Xin chào 👋</p>
            <p>Upload CV hoặc hỏi bất kỳ câu hỏi nào về phỏng vấn IT.</p>
          </div>
        )}
        {messagesList.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "user" ? (
              <div className="max-w-[85%] px-3 py-2 rounded-md text-[13px] leading-relaxed whitespace-pre-wrap break-words bg-[#2a2d3a] text-[#e4e4e4] border border-[#343850]">
                {m.content}
              </div>
            ) : (
              <div
                className={`max-w-[88%] px-3 py-2 rounded-md text-[13px] leading-relaxed whitespace-pre-wrap break-words border-l-2 ${
                  m.isCVAnalysis
                    ? "bg-[#221c12] border-[#b8860b] text-[#e4e4e4]"
                    : "bg-[#1f1f1f] border-[#3b82f6] text-[#dcdcdc]"
                }`}
              >
                {m.content}
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

      {/* Composer (Cursor-style: upload + input combined in one bordered block) */}
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
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={cvUploading}
              title="Upload CV (PDF)"
              className="flex items-center gap-1 text-[11.5px] px-2 py-1 rounded text-[#9a9a9a] hover:bg-[#2a2a2a] hover:text-[#e4e4e4] disabled:opacity-50 transition-colors"
            >
              {cvUploading ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#b8860b] animate-pulse" />
                  Đang upload...
                </>
              ) : (
                <>
                  <IconPaperclip />
                  CV.pdf
                </>
              )}
            </button>
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
    </div>
  );
}
