"use client";

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

export default function QuestionsDrawer({
  open,
  onClose,
  role,
  meetingCode,
  currentUserId,
}: Props) {
  const { questions, activeQuestion, isLoading, error } = useQuestions();

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`
          fixed inset-0 bg-black/50 z-40 transition-opacity
          ${open ? "opacity-100" : "opacity-0 pointer-events-none"}
        `}
      />

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 right-0 h-screen w-[420px]
          bg-[#051424]
          border-l border-[#3b494b]
          z-50
          transition-transform duration-300
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="h-16 px-6 flex items-center justify-between border-b border-[#3b494b]">
          <h2 className="text-white font-semibold">Câu hỏi phỏng vấn</h2>

          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar h-[calc(100vh-64px)]">
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
      </aside>
    </>
  );
}
