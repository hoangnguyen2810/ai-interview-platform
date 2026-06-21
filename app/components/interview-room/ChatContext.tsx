"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import type { Call } from "@stream-io/video-react-sdk";

export interface ChatMessage {
  id: string;
  senderId: string | null;
  senderName: string;
  content: string;
  type: "TEXT" | "SYSTEM";
  createdAt: string;
  /** true if this message was sent by the current user */
  isMine: boolean;
}

interface ChatContextValue {
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  isLoading: boolean;
  unreadCount: number;
  markRead: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const STREAM_CHAT_EVENT = "custom:chat_message";
const CURRENT_USER_ID_KEY = "chat_user_id";

interface StreamChatPayload {
  id: string;
  senderId: string | null;
  senderName: string;
  content: string;
  type: "TEXT" | "SYSTEM";
  createdAt: string;
}

export function ChatProvider({
  children,
  call,
  meetingCode,
  currentUserId,
}: {
  children: ReactNode;
  call: Call | null;
  meetingCode: string;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Store current user ID so we can determine "isMine" on incoming events
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(CURRENT_USER_ID_KEY, currentUserId);
    }
  }, [currentUserId]);

  // Load initial message history
  useEffect(() => {
    if (!meetingCode) return;

    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/interviews/${encodeURIComponent(meetingCode)}/messages`,
          { credentials: "include" },
        );
        if (!res.ok) return;

        const json = await res.json().catch(() => null);
        if (!json?.messages) return;

        const myId = typeof window !== "undefined"
          ? sessionStorage.getItem(CURRENT_USER_ID_KEY) ?? currentUserId
          : currentUserId;

        if (cancelled) return;
        const msgs: ChatMessage[] = json.messages.map(
          (m: {
            id: string;
            senderId: string | null;
            senderName: string;
            content: string;
            type: "TEXT" | "SYSTEM";
            createdAt: string;
          }) => ({
            ...m,
            isMine: m.senderId === myId,
          }),
        );
        setMessages(msgs);
        setUnreadCount(0);
      } catch (err) {
        console.error("[chat] load messages error:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [meetingCode, currentUserId]);

  // Listen for incoming messages via Stream custom events
  useEffect(() => {
    if (!call) return;

    const handler = (event: { custom: Record<string, unknown> }) => {
      const { type: eventType, messageType, ...payload } = event.custom ?? {};
      if (eventType !== STREAM_CHAT_EVENT) return;

      const data = payload as unknown as Omit<StreamChatPayload, "type"> & { type?: string; messageType?: string };
      if (!data?.id) return;

      const myId =
        typeof window !== "undefined"
          ? sessionStorage.getItem(CURRENT_USER_ID_KEY) ?? currentUserId
          : currentUserId;

      const msg: ChatMessage = {
        id: data.id as string,
        senderId: data.senderId as string | null,
        senderName: (data.senderName as string | undefined) ?? "Unknown",
        content: data.content as string,
        type: (data.messageType as "TEXT" | "SYSTEM") ?? "TEXT",
        createdAt: data.createdAt as string,
        isMine: data.senderId === myId,
      };

      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setUnreadCount((n) => n + 1);
    };

    call.on("custom", handler);
    return () => {
      call.off("custom", handler);
    };
  }, [call, currentUserId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !meetingCode) return;

      // Optimistic append
      const tempId = `temp-${Date.now()}`;
      const myId =
        typeof window !== "undefined"
          ? sessionStorage.getItem(CURRENT_USER_ID_KEY) ?? currentUserId
          : currentUserId;
      const optimistic: ChatMessage = {
        id: tempId,
        senderId: myId,
        senderName: "Bạn",
        content: content.trim(),
        type: "TEXT",
        createdAt: new Date().toISOString(),
        isMine: true,
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const res = await fetch(
          `/api/interviews/${encodeURIComponent(meetingCode)}/messages`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          },
        );

        if (!res.ok) {
          let detail = "";
          try {
            const errJson = await res.json();
            detail = errJson?.message ?? "";
          } catch {}
          throw new Error(`Failed to send (${res.status})${detail ? `: ${detail}` : ""}`);
        }

        const json = await res.json().catch(() => null);
        const sent: ChatMessage | null = json?.message ?? null;

        // Replace optimistic with real message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...(sent ?? m),
                  id: sent?.id ?? m.id,
                  isMine: true,
                }
              : m,
          ),
        );

        // Broadcast to other participants via Stream custom event
        if (sent && call) {
          await call.sendCustomEvent({
            type: STREAM_CHAT_EVENT,
            id: sent.id,
            senderId: sent.senderId,
            senderName: sent.senderName,
            content: sent.content,
            messageType: sent.type,
            createdAt: sent.createdAt,
          });
        }
      } catch (err) {
        console.error("[chat] send error:", err);
        // Remove optimistic on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    },
    [meetingCode, call, currentUserId],
  );

  const markRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({ messages, sendMessage, isLoading, unreadCount, markRead }),
    [messages, sendMessage, isLoading, unreadCount, markRead],
  );

  return (
    <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used inside <ChatProvider>");
  }
  return ctx;
}
