"use client";

import React, { useState, useRef, useCallback } from "react";

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

export default function AIDrawer({ open, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvDragging, setCvDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Send chat message ──────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input;

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: data.reply || "No response" },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Error calling API" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ─── Upload & analyze CV ────────────────────────────────────────────────────
  const uploadCV = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: "Chỉ hỗ trợ file PDF. Vui lòng chọn file có định dạng .pdf",
          isCVAnalysis: false,
        },
      ]);
      return;
    }

    setCvUploading(true);
    setCvFile(file);

    // Show pending message
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
  }, []);

  // ─── File input handlers ────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadCV(file);
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setCvDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadCV(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setCvDragging(true);
  };

  const handleDragLeave = () => setCvDragging(false);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-[500px] z-50
          bg-[#0b1220]/95 backdrop-blur-xl
          border-l border-white/10
          shadow-2xl flex flex-col
          transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* HEADER */}
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-white font-semibold">AI Assistant</h2>
          </div>

          {/* CV Upload button in header */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={cvUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/20
              text-cyan-300 text-sm transition
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
              <path d="M9 13h6v2H9zm0 4h6v2H9zm0-8h4v2H9z" />
            </svg>
            {cvUploading ? "Đang phân tích..." : "Upload CV"}
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* CV DROP ZONE */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            flex items-center gap-2 px-4 py-2 text-xs border-b
            transition-colors duration-200
            ${cvDragging
              ? "bg-cyan-500/10 border-cyan-400/30 text-cyan-300"
              : "bg-transparent border-transparent text-gray-500"}
          `}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-3.5 h-3.5 shrink-0"
          >
            <path d="M12 16V4m0 0L8 8m4-4 4 4" />
            <path d="M3 15V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
          </svg>
          {cvDragging
            ? "Thả file PDF vào đây để phân tích..."
            : "Kéo thả file PDF vào đây hoặc dùng nút Upload CV ở trên"}
        </div>

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-4">
          {messages.length === 0 && !cvUploading && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-7 h-7 text-cyan-400"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium text-sm">AI Assistant</p>
                <p className="text-gray-400 text-xs mt-1">
                  Hỏi đáp về lập trình hoặc upload CV để phân tích
                </p>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                  transition-all duration-200
                  ${
                    m.role === "user"
                      ? "bg-cyan-600/20 border border-cyan-400/30 text-cyan-200"
                      : m.isCVAnalysis
                        ? "bg-cyan-500/10 border border-cyan-400/30 text-white"
                        : "bg-white/5 border border-white/10 text-white"
                  }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {cvUploading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-4 py-3 rounded-2xl text-sm
                bg-cyan-500/10 border border-cyan-400/30 text-gray-300">
                <div className="flex items-center gap-2">
                  <svg
                    className="animate-spin w-4 h-4 text-cyan-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
                    />
                  </svg>
                  Đang phân tích CV...
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="text-gray-400 text-sm flex items-center gap-2">
              <span className="animate-pulse">●</span>
              AI is thinking...
            </div>
          )}
        </div>

        {/* INPUT BAR */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2
            focus-within:border-cyan-500/40 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.15)] transition">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask AI anything..."
              disabled={loading}
              className="flex-1 bg-transparent text-white outline-none text-sm placeholder:text-gray-500 disabled:opacity-50"
            />

            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30
                text-cyan-300 text-sm transition
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>

          <div className="text-[11px] text-gray-500 mt-2 text-center">
            AI assistant powered by local model
          </div>
        </div>
      </div>
    </>
  );
}
