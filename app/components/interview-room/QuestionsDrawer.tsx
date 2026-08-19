"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useQuestions } from "./QuestionContext";
import RecruiterQuestionsPanel from "./RecruiterQuestionsPanel";

type Props = {
  open: boolean;
  onClose: () => void;
  role: "recruiter" | "candidate";
  meetingCode: string;
  /** UUID của user hiện tại (cần cho chức năng edit — chỉ author mới được sửa) */
  currentUserId?: string;
};

const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 560; // chiều cao mặc định, panel vẫn scroll nội bộ nếu nội dung dài hơn

export default function QuestionsDrawer({
  open,
  onClose,
  role,
  meetingCode,
  currentUserId,
}: Props) {
  const { questions, activeQuestion, isLoading, error } = useQuestions();

  // Vị trí góc trên-trái của panel (px, theo viewport)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    dragging: boolean;
    startMouseX: number;
    startMouseY: number;
    startPosX: number;
    startPosY: number;
  }>({
    dragging: false,
    startMouseX: 0,
    startMouseY: 0,
    startPosX: 0,
    startPosY: 0,
  });

  // Đặt vị trí mặc định (góc trên-phải) khi mở lần đầu / khi resize window
  useEffect(() => {
    if (!open) return;
    setPos((prev) => {
      if (prev) return prev; // giữ nguyên vị trí user đã kéo trước đó
      const x = Math.max(16, window.innerWidth - PANEL_WIDTH - 24);
      const y = 80;
      return { x, y };
    });
  }, [open]);

  const clamp = useCallback((x: number, y: number) => {
    const maxX = window.innerWidth - PANEL_WIDTH - 8;
    const maxY = window.innerHeight - 48; // để lại ít nhất phần header lộ ra
    return {
      x: Math.min(Math.max(8, x), Math.max(8, maxX)),
      y: Math.min(Math.max(8, y), Math.max(8, maxY)),
    };
  }, []);

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragRef.current.dragging) return;
      const dx = clientX - dragRef.current.startMouseX;
      const dy = clientY - dragRef.current.startMouseY;
      const next = clamp(
        dragRef.current.startPosX + dx,
        dragRef.current.startPosY + dy,
      );
      setPos(next);
    },
    [clamp],
  );

  const stopDragging = useCallback(() => {
    dragRef.current.dragging = false;
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) =>
      handlePointerMove(e.clientX, e.clientY);
    const onMouseUp = () => stopDragging();
    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current.dragging) return;
      const t = e.touches[0];
      if (t) handlePointerMove(t.clientX, t.clientY);
    };
    const onTouchEnd = () => stopDragging();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [handlePointerMove, stopDragging]);

  const startDrag = (clientX: number, clientY: number) => {
    if (!pos) return;
    dragRef.current = {
      dragging: true,
      startMouseX: clientX,
      startMouseY: clientY,
      startPosX: pos.x,
      startPosY: pos.y,
    };
    document.body.style.userSelect = "none";
  };

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    startDrag(e.clientX, e.clientY);
  };

  const onHeaderTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) startDrag(t.clientX, t.clientY);
  };

  if (!open || !pos) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: PANEL_WIDTH,
        maxHeight: `min(${PANEL_HEIGHT}px, calc(100vh - 32px))`,
        zIndex: 50,
      }}
      className="flex flex-col bg-[#051424] border border-[#3b494b] rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
    >
      {/* Header — kéo để di chuyển */}
      <div
        onMouseDown={onHeaderMouseDown}
        onTouchStart={onHeaderTouchStart}
        className="h-14 px-4 flex items-center justify-between border-b border-[#3b494b] cursor-move select-none shrink-0"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-gray-400 text-base">
            drag_indicator
          </span>
          <h2 className="text-white font-semibold text-sm">
            Câu hỏi phỏng vấn
          </h2>
        </div>

        <button
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          className="text-gray-400 hover:text-white"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="p-4 overflow-y-auto custom-scrollbar">
        {role === "recruiter" ? (
          <RecruiterQuestionsPanel
            meetingCode={meetingCode}
            currentUserId={currentUserId}
          />
        ) : (
          /* ── Candidate view ── */
          <div className="flex flex-col gap-4">
            {isLoading && (
              <p className="text-gray-500 text-sm">Đang tải câu hỏi...</p>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {!isLoading && questions.length === 0 && (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-4xl text-gray-600">
                  pending_actions
                </span>
                <p className="text-gray-500 text-sm mt-2">
                  Chưa có câu hỏi nào được giao
                </p>
              </div>
            )}
            {questions.length > 0 && (
              <div className="space-y-3">
                {questions.map((q) => {
                  const isActive = activeQuestion?.id === q.id;
                  return (
                    <div
                      key={q.id}
                      className={`
                        p-4 rounded-lg border transition-all
                        ${
                          isActive
                            ? "border-cyan-500 bg-cyan-500/10"
                            : "border-[#1e3a50] bg-[#0d2035] opacity-60"
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {isActive && (
                          <span className="material-symbols-outlined text-cyan-400 text-sm">
                            play_arrow
                          </span>
                        )}
                        <span className="text-white font-semibold text-sm">
                          {q.title}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs leading-relaxed">
                        {q.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
