"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuestions, type CodingQuestion } from "./QuestionContext";

type AvailableQuestion = {
  id: string;
  title: string;
  description: string;
  difficulty: string | null;
  createdAt: string;
  isAssigned: boolean;
};

interface Props {
  meetingCode: string;
}

// ─── Create Question Form ──────────────────────────────────────────────────────

function CreateQuestionForm({
  meetingCode,
  onSuccess,
  onCancel,
}: {
  meetingCode: string;
  onSuccess: (q: CodingQuestion) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"" | "EASY" | "MEDIUM" | "HARD">("");
  const [assignToInterview, setAssignToInterview] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("Tiêu đề và mô tả không được để trống.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/questions/create`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, difficulty: difficulty || null, assignToInterview }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Lỗi khi tạo câu hỏi.");
        return;
      }
      onSuccess(data.question);
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#0d2035] border border-[#1e3a50] rounded-lg p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-cyan-400 font-semibold text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-base">add_circle</span>
          Tạo câu hỏi mới
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-white text-sm"
        >
          Hủy
        </button>
      </div>

      <div>
        <label className="block text-gray-300 text-xs mb-1.5 font-medium">
          Tiêu đề <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: Reverse a Linked List"
          className="w-full bg-[#122131] border border-[#3b494b] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-cyan-400 transition-colors placeholder-gray-600"
          maxLength={255}
        />
      </div>

      <div>
        <label className="block text-gray-300 text-xs mb-1.5 font-medium">
          Mô tả <span className="text-red-400">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả chi tiết bài toán, input, output, constraints..."
          rows={5}
          className="w-full bg-[#122131] border border-[#3b494b] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-cyan-400 transition-colors resize-none placeholder-gray-600 leading-relaxed"
        />
      </div>

      <div>
        <label className="block text-gray-300 text-xs mb-1.5 font-medium">
          Độ khó
        </label>
        <div className="flex gap-2">
          {(["EASY", "MEDIUM", "HARD"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(difficulty === d ? "" : d)}
              className={`
                flex-1 py-2 rounded-lg text-xs font-semibold transition-all border
                ${difficulty === d
                  ? d === "EASY"
                    ? "bg-green-500/20 border-green-500 text-green-400"
                    : d === "MEDIUM"
                      ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                      : "bg-red-500/20 border-red-500 text-red-400"
                  : "bg-[#122131] border-[#3b494b] text-gray-400 hover:border-gray-500"
                }
              `}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={assignToInterview}
          onChange={(e) => setAssignToInterview(e.target.checked)}
          className="accent-cyan-500"
        />
        <span className="text-gray-300 text-xs">
          Thêm ngay vào danh sách câu hỏi phỏng vấn
        </span>
      </label>

      {error && (
        <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#051424] font-semibold text-sm transition-colors disabled:opacity-50"
      >
        {submitting ? "Đang tạo..." : "Tạo câu hỏi"}
      </button>
    </form>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function RecruiterQuestionsPanel({ meetingCode }: Props) {
  const { questions, activeQuestion, setActiveQuestion, refreshQuestions } =
    useQuestions();

  const [available, setAvailable] = useState<AvailableQuestion[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [settingId, setSettingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Load available questions from system library
  const loadAvailable = useCallback(async () => {
    setLoadingAvailable(true);
    try {
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/questions/available`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAvailable(data.questions ?? []);
    } catch {
      // silent
    } finally {
      setLoadingAvailable(false);
    }
  }, [meetingCode]);

  useEffect(() => {
    loadAvailable();
  }, [loadAvailable]);

  // Add existing question from library to interview
  const handleAddQuestion = async (questionId: string) => {
    setAddingId(questionId);
    try {
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/questions/available`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId }),
        },
      );
      if (res.ok) {
        await Promise.all([loadAvailable(), refreshQuestions()]);
      }
    } finally {
      setAddingId(null);
    }
  };

  // Set active question for candidate
  const handleSetActive = async (question: CodingQuestion) => {
    setSettingId(question.id);
    try {
      setActiveQuestion(question);
    } finally {
      setSettingId(null);
    }
  };

  // Called when a new question is created
  const handleQuestionCreated = (q: CodingQuestion) => {
    setShowCreateForm(false);
    refreshQuestions();
    loadAvailable();
  };

  const difficultyColor = (d: string | null) => {
    if (d === "EASY") return "text-green-400 bg-green-400/10 border-green-400/20";
    if (d === "MEDIUM") return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
    if (d === "HARD") return "text-red-400 bg-red-400/10 border-red-400/20";
    return "text-gray-400 bg-gray-400/10 border-gray-400/20";
  };

  const difficultyBadge = (d: string | null) => (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${difficultyColor(d)}`}>
      {d ?? "—"}
    </span>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* ── Create form ── */}
      {showCreateForm ? (
        <CreateQuestionForm
          meetingCode={meetingCode}
          onSuccess={handleQuestionCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-[#1e3a50] text-cyan-400 hover:border-cyan-500 hover:bg-cyan-500/5 transition-all text-sm font-medium"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Tạo câu hỏi mới
        </button>
      )}

      {/* ── Assigned questions ── */}
      <section>
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-cyan-400 text-lg">
            checklist
          </span>
          Câu hỏi phỏng vấn
          {questions.length > 0 && (
            <span className="ml-1 text-xs text-gray-500 font-normal">
              ({questions.length})
            </span>
          )}
        </h3>

        {questions.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Chưa có câu hỏi nào. Tạo mới hoặc thêm từ thư viện bên dưới.
          </p>
        ) : (
          <div className="space-y-2">
            {questions.map((q) => {
              const isActive = activeQuestion?.id === q.id;
              return (
                <div
                  key={q.id}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer group
                    ${isActive
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-[#1e3a50] bg-[#0d2035] hover:border-cyan-500/50"
                    }
                  `}
                  onClick={() => handleSetActive(q)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {isActive && (
                        <span className="text-cyan-400 material-symbols-outlined text-sm shrink-0">
                          play_arrow
                        </span>
                      )}
                      <span className="text-white font-medium text-sm">
                        {q.title}
                      </span>
                      {difficultyBadge(q.difficulty)}
                    </div>
                    <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed">
                      {q.description}
                    </p>
                  </div>
                  <button
                    className={`
                      shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                      ${isActive
                        ? "bg-cyan-500 text-[#051424]"
                        : "bg-[#16304b] text-cyan-400 hover:bg-cyan-500 hover:text-[#051424]"
                      }
                    `}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetActive(q);
                    }}
                    disabled={settingId === q.id}
                  >
                    {settingId === q.id ? "..." : isActive ? "Đang chọn" : "Chọn"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Library ── */}
      <section>
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-cyan-400 text-lg">
            library_books
          </span>
          Thư viện câu hỏi
          {available.length > 0 && (
            <span className="ml-1 text-xs text-gray-500 font-normal">
              ({available.length})
            </span>
          )}
        </h3>

        {loadingAvailable ? (
          <p className="text-gray-500 text-sm">Đang tải...</p>
        ) : available.length === 0 ? (
          <p className="text-gray-500 text-sm">Không có câu hỏi nào.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {available.map((q) => (
              <div
                key={q.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-[#1e3a50] bg-[#0d2035] hover:border-cyan-500/50 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-white text-sm truncate">{q.title}</span>
                    {difficultyBadge(q.difficulty)}
                  </div>
                  <p className="text-gray-500 text-xs line-clamp-1 leading-relaxed">
                    {q.description}
                  </p>
                </div>
                <button
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#16304b] text-cyan-400 hover:bg-cyan-500 hover:text-[#051424] transition-colors disabled:opacity-50"
                  onClick={() => handleAddQuestion(q.id)}
                  disabled={addingId === q.id || q.isAssigned}
                >
                  {addingId === q.id ? "..." : q.isAssigned ? "Đã thêm" : "+ Thêm"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
