"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useChat } from "./ChatContext";

type Props = {
  open: boolean;
  onClose: () => void;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday) return "Hôm nay";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isYesterday) return "Hôm qua";

  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function DateDivider({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-2 my-3">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-[10px] text-gray-500 uppercase tracking-wider px-2">
        {formatDate(date)}
      </span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

export default function ChatDrawer({ open, onClose }: Props) {
  const { messages, sendMessage, isLoading, unreadCount } = useChat();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevLenRef = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!open) return;
    if (messages.length > prevLenRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLenRef.current = messages.length;
  }, [messages, open]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);
    try {
      await sendMessage(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const grouped: { date: string; messages: (typeof messages)[number][] }[] =
    [];
  for (const msg of messages) {
    const date = new Date(msg.createdAt).toDateString();
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      grouped.push({ date, messages: [msg] });
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-[380px] flex flex-col bg-[#0d1c2d] border-l border-white/10 shadow-2xl transition-transform duration-300 z-50 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-white font-semibold text-base">Tin nhắn</h2>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-cyan-400 text-black text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {isLoading && messages.length === 0 && (
            <div className="flex items-center justify-center h-24">
              <div className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            </div>
          )}

          {!isLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <span className="material-symbols-outlined text-3xl mb-2">
                chat_bubble_outline
              </span>
              <p className="text-sm">Chưa có tin nhắn nào</p>
              <p className="text-xs mt-1">Gửi tin nhắn đầu tiên</p>
            </div>
          )}

          {grouped.map(({ date, messages: dayMessages }) => (
            <React.Fragment key={date}>
              <DateDivider date={date} />
              {dayMessages.map((msg) => {
                if (msg.type === "SYSTEM") {
                  return (
                    <div
                      key={msg.id}
                      className="flex justify-center my-2"
                    >
                      <span className="text-[11px] text-gray-500 italic px-3 py-1 bg-white/5 rounded-full">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col mb-2 ${
                      msg.isMine ? "items-end" : "items-start"
                    }`}
                  >
                    {!msg.isMine && (
                      <span className="text-[10px] text-gray-400 ml-2 mb-0.5">
                        {msg.senderName}
                      </span>
                    )}
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        msg.isMine
                          ? "bg-cyan-500 text-black rounded-br-md"
                          : "bg-[#163149] text-white rounded-bl-md"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span
                      className={`text-[10px] text-gray-600 mt-0.5 ${
                        msg.isMine ? "mr-2" : "ml-2"
                      }`}
                    >
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-white/10 p-3">
          <div className="flex items-end gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập tin nhắn..."
              maxLength={1000}
              className="flex-1 bg-[#122131] text-white text-sm rounded-xl px-4 py-2.5 border border-[#2a3b4f] placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                input.trim() && !sending
                  ? "bg-cyan-400 text-black hover:bg-cyan-300 cursor-pointer"
                  : "bg-[#1b2a3a] text-gray-500 cursor-not-allowed"
              }`}
            >
              {sending ? (
                <div className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-lg leading-none">
                  send
                </span>
              )}
            </button>
          </div>
          <p className="text-[10px] text-gray-600 mt-1 text-center">
            Nhấn Enter để gửi · Shift+Enter cho xuống dòng
          </p>
        </div>
      </div>
    </>
  );
}
