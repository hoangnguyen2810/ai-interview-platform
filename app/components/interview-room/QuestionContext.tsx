"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { io, type Socket } from "socket.io-client";
import type { Call } from "@stream-io/video-react-sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CodingQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
  order?: number;
}

export interface QuestionContextValue {
  questions: CodingQuestion[];
  activeQuestion: CodingQuestion | null;
  isLoading: boolean;
  error: string | null;
  setActiveQuestion: (question: CodingQuestion) => void;
  refreshQuestions: () => void;
  /** Trả về success boolean; caller tự gọi nếu cần refresh lại từ server */
  removeQuestion: (questionId: string) => Promise<boolean>;
  /** Cập nhật nội dung 1 câu hỏi (cần revalidate với server). Trả về success */
  updateQuestionLocal: (question: CodingQuestion) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
const STREAM_QUESTION_EVENT = "custom:question_update";
const CURRENT_USER_ID_KEY = "chat_user_id";

interface StreamSetActivePayload {
  type: string;
  action: "set_active" | "custom_question";
  questionId: string | null;
  title?: string;
  description?: string;
  difficulty?: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const QuestionContext = createContext<QuestionContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface QuestionProviderProps {
  call: Call | null;
  meetingCode: string;
  children: React.ReactNode;
}

export function QuestionProvider({
  call,
  meetingCode,
  children,
}: QuestionProviderProps) {
  const [questions, setQuestions] = useState<CodingQuestion[]>([]);
  const [activeQuestion, setActiveQuestionState] = useState<CodingQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to Socket.IO server
    const socket = io(SOCKET_URL, {
      query: { meetingCode },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log(`[Socket.IO] Connected: ${socket.id}`);
    });

    socket.on("connect_error", (err) => {
      console.warn(`[Socket.IO] Connection error:`, err.message);
    });

    // ── question:added ──────────────────────────────────────────────────────────
    // Recruiter vừa tạo câu hỏi mới → thêm vào danh sách
    socket.on("question:added", (question: CodingQuestion) => {
      console.log(`[Socket.IO] question:added received:`, question);
      setQuestions((prev) => {
        if (prev.some((q) => q.id === question.id)) return prev;
        return [...prev, question];
      });
    });

    // ── question:updated ───────────────────────────────────────────────────────
    // Recruiter vừa sửa câu hỏi → cập nhật nội dung trong danh sách.
    // Nếu câu hỏi đang active thì cũng refresh activeQuestion.
    socket.on("question:updated", (question: CodingQuestion) => {
      console.log(`[Socket.IO] question:updated received:`, question);
      setQuestions((prev) =>
        prev.map((q) => (q.id === question.id ? { ...q, ...question } : q)),
      );
      setActiveQuestionState((prev) =>
        prev && prev.id === question.id ? { ...prev, ...question } : prev,
      );
    });

    // ── question:removed ───────────────────────────────────────────────────────
    // Recruiter xoá câu hỏi khỏi buổi phỏng vấn → remove khỏi danh sách
    // và clear activeQuestion nếu trùng.
    socket.on("question:removed", (payload: { questionId: string }) => {
      const qid = payload?.questionId;
      if (!qid) return;
      console.log(`[Socket.IO] question:removed received:`, qid);
      setQuestions((prev) => prev.filter((q) => q.id !== qid));
      setActiveQuestionState((prev) => (prev?.id === qid ? null : prev));
    });

    // ── question:activated ──────────────────────────────────────────────────────
    // Recruiter chọn câu hỏi active → hiển thị cho candidate
    socket.on("question:activated", (question: CodingQuestion) => {
      console.log(`[Socket.IO] question:activated received:`, question);
      setActiveQuestionState(question);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [meetingCode]);

  // ─── Stream events (existing, keep for backward compat) ───────────────────────
  useEffect(() => {
    if (!call) return;

    const handler = (event: { custom: Record<string, unknown> }) => {
      const payload = event.custom ?? {};
      if (payload.type !== STREAM_QUESTION_EVENT) return;

      const data = payload as unknown as StreamSetActivePayload;

      if (data.action === "set_active") {
        if (!data.questionId) {
          setActiveQuestionState(null);
          return;
        }
        const qId: string = data.questionId;
        setActiveQuestionState((prev) =>
          prev?.id === qId ? prev : {
            id: qId,
            title: data.title ?? "",
            description: data.description ?? "",
            difficulty: (data.difficulty as CodingQuestion["difficulty"]) ?? null,
          }
        );
      } else if (data.action === "custom_question") {
        setActiveQuestionState({
          id: data.questionId ?? "custom",
          title: data.title ?? "Custom Question",
          description: data.description ?? "",
          difficulty: (data.difficulty as CodingQuestion["difficulty"]) ?? null,
        });
      }
    };

    call.on("custom", handler);
    return () => { call.off("custom", handler); };
  }, [call]);

  // ─── API: refresh questions from DB ─────────────────────────────────────────
  const refreshQuestions = useCallback(async () => {
    if (!meetingCode) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/questions`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Lỗi tải câu hỏi" }));
        throw new Error(err.message);
      }
      const data = await res.json();
      setQuestions(data.questions ?? []);
      const activeId = data.activeQuestionId;
      if (activeId) {
        const active = data.questions.find((q: CodingQuestion) => q.id === activeId);
        setActiveQuestionState(active ?? null);
      } else {
        setActiveQuestionState(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải câu hỏi");
    } finally {
      setIsLoading(false);
    }
  }, [meetingCode]);

  // Initial load
  useEffect(() => {
    refreshQuestions();
  }, [refreshQuestions]);

  // ─── Set active question (recruiter action) ────────────────────────────────
  const setActiveQuestion = useCallback(
    async (question: CodingQuestion) => {
      setActiveQuestionState(question);

      try {
        await fetch(
          `/api/interviews/${encodeURIComponent(meetingCode)}/questions`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId: question.id }),
          },
        );
      } catch {
        // non-critical
      }

      // Also broadcast via Stream (existing behavior)
      if (call) {
        await call.sendCustomEvent({
          type: STREAM_QUESTION_EVENT,
          action: "set_active",
          questionId: question.id,
          title: question.title,
          description: question.description,
          difficulty: question.difficulty,
        });
      }
    },
    [call, meetingCode],
  );

  // ─── Xoá câu hỏi khỏi buổi phỏng vấn (recruiter action) ──────────────────
  const removeQuestion = useCallback(
    async (questionId: string): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/interviews/${encodeURIComponent(meetingCode)}/questions/${encodeURIComponent(questionId)}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );
        const data = await res.json().catch(() => ({ success: false }));
        if (!res.ok || !data.success) {
          console.error("[removeQuestion]", data.message ?? res.statusText);
          return false;
        }
        // Optimistic local update — backend đã emit socket event rồi,
        // nhưng cập nhật ngay để UI không phải chờ round-trip.
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
        setActiveQuestionState((prev) =>
          prev?.id === questionId ? null : prev,
        );
        return true;
      } catch (err) {
        console.error("[removeQuestion]", err);
        return false;
      }
    },
    [meetingCode],
  );

  // ─── Update local state khi nhận socket event (hoặc sau PATCH) ─────────────
  const updateQuestionLocal = useCallback((question: CodingQuestion) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === question.id ? { ...q, ...question } : q)),
    );
    setActiveQuestionState((prev) =>
      prev && prev.id === question.id ? { ...prev, ...question } : prev,
    );
  }, []);

  return (
    <QuestionContext.Provider
      value={{
        questions,
        activeQuestion,
        isLoading,
        error,
        setActiveQuestion,
        refreshQuestions,
        removeQuestion,
        updateQuestionLocal,
      }}
    >
      {children}
    </QuestionContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useQuestions(): QuestionContextValue {
  const ctx = useContext(QuestionContext);
  if (!ctx) throw new Error("useQuestions must be used within QuestionProvider");
  return ctx;
}
