"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuestions, type CodingQuestion } from "./QuestionContext";

type AvailableQuestion = {
  id: string;
  title: string;
  description: string;
  difficulty: string | null;
  createdAt: string;
  isAssigned: boolean;
};
const difficultyColor = (d: string | null) => {
  if (d === "EASY") return "text-green-400 bg-green-400/10 border-green-400/20";
  if (d === "MEDIUM")
    return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
  if (d === "HARD") return "text-red-400 bg-red-400/10 border-red-400/20";
  return "text-gray-400 bg-gray-400/10 border-gray-400/20";
};

const difficultyLabel = (d: string | null) => {
  switch (d) {
    case "EASY":
      return "Dễ";
    case "MEDIUM":
      return "Trung bình";
    case "HARD":
      return "Khó";
    default:
      return "—";
  }
};

interface Props {
  meetingCode: string;
  /** UUID của recruiter hiện tại — để check quyền sửa câu hỏi */
  currentUserId?: string;
}

// ─── Shared Question Form (create + edit) ─────────────────────────────────────

function QuestionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: {
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD" | null;
  };
  submitLabel: string;
  onSubmit: (data: {
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD" | null;
  }) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [difficulty, setDifficulty] = useState<"" | "EASY" | "MEDIUM" | "HARD">(
    initial?.difficulty ?? "",
  );
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
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        difficulty: difficulty === "" ? null : difficulty,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
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
          <span className="material-symbols-outlined text-base">
            {initial ? "edit" : "add_circle"}
          </span>
          {initial ? "Sửa câu hỏi" : "Tạo câu hỏi mới"}
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
                ${
                  difficulty === d
                    ? d === "EASY"
                      ? "bg-green-500/20 border-green-500 text-green-400"
                      : d === "MEDIUM"
                        ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                        : "bg-red-500/20 border-red-500 text-red-400"
                    : "bg-[#122131] border-[#3b494b] text-gray-400 hover:border-gray-500"
                }
              `}
            >
              {difficultyLabel(d)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#051424] font-semibold text-sm transition-colors disabled:opacity-50"
        >
          {submitting ? "Đang lưu..." : submitLabel}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-semibold text-sm transition-colors"
          >
            Xoá
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Create Question wrapper ──────────────────────────────────────────────────

function CreateQuestionForm({
  meetingCode,
  onSuccess,
  onCancel,
}: {
  meetingCode: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  return (
    <QuestionForm
      submitLabel="Tạo câu hỏi"
      onSubmit={async ({ title, description, difficulty }) => {
        const res = await fetch(
          `/api/interviews/${encodeURIComponent(meetingCode)}/questions/create`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              description,
              difficulty,
              assignToInterview: true,
            }),
          },
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message ?? "Lỗi khi tạo câu hỏi.");
        }
        onSuccess();
      }}
      onCancel={onCancel}
    />
  );
}

// ─── Edit Question wrapper ───────────────────────────────────────────────────

function EditQuestionForm({
  meetingCode,
  question,
  onSuccess,
  onCancel,
  onDelete,
}: {
  meetingCode: string;
  question: CodingQuestion;
  onSuccess: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <QuestionForm
      initial={{
        title: question.title,
        description: question.description,
        difficulty: question.difficulty ?? null,
      }}
      submitLabel="Lưu thay đổi"
      onSubmit={async ({ title, description, difficulty }) => {
        const res = await fetch(
          `/api/interviews/${encodeURIComponent(meetingCode)}/questions/${encodeURIComponent(question.id)}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, description, difficulty }),
          },
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message ?? "Lỗi khi sửa câu hỏi.");
        }
        onSuccess();
      }}
      onCancel={onCancel}
      onDelete={onDelete}
    />
  );
}

// ─── Delete confirm modal ────────────────────────────────────────────────────

function DeleteConfirm({
  question,
  deleting,
  onConfirm,
  onCancel,
}: {
  question: CodingQuestion;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#0d2035] border border-red-500/40 rounded-xl p-5 max-w-sm w-full shadow-2xl">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-red-400">
              warning
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-base">
              Xoá câu hỏi khỏi buổi phỏng vấn?
            </h3>
            <p className="text-gray-400 text-xs mt-1">
              Câu hỏi sẽ bị gỡ khỏi buổi phỏng vấn này nhưng vẫn còn trong thư
              viện để dùng lại sau.
            </p>
          </div>
        </div>

        <div className="bg-[#122131] border border-[#1e3a50] rounded-lg p-3 mb-4">
          <p className="text-white text-sm font-medium truncate">
            {question.title}
          </p>
          <p className="text-gray-500 text-xs mt-1 line-clamp-2">
            {question.description}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-2 rounded-lg bg-[#122131] hover:bg-[#1a3147] text-gray-300 border border-[#3b494b] font-semibold text-sm transition-colors disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {deleting ? "Đang xoá..." : "Xoá"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export default function RecruiterQuestionsPanel({
  meetingCode,
  currentUserId,
}: Props) {
  // currentUserId reserved for future client-side ownership checks; backend
  // currently enforces edit permission via `created_by` check in the PATCH route.
  void currentUserId;
  const {
    questions,
    activeQuestion,
    setActiveQuestion,
    refreshQuestions,
    removeQuestion,
    updateQuestionLocal,
  } = useQuestions();

  const [available, setAvailable] = useState<AvailableQuestion[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [settingId, setSettingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<CodingQuestion | null>(
    null,
  );
  const [deleting, setDeleting] = useState<CodingQuestion | null>(null);

  // ─── Load available questions from system library ────────────────────────
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

  // ─── Add existing question from library to interview ──────────────────────
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

  // ─── Set active question for candidate ───────────────────────────────────
  const handleSetActive = async (question: CodingQuestion) => {
    setSettingId(question.id);
    try {
      setActiveQuestion(question);
    } finally {
      setSettingId(null);
    }
  };

  // ─── Called when a new question is created ──────────────────────────────
  const handleQuestionCreated = () => {
    setShowCreateForm(false);
    refreshQuestions();
    loadAvailable();
  };

  // ─── Called when a question is updated ──────────────────────────────────
  const handleQuestionUpdated = () => {
    setEditingQuestion(null);
    // refresh từ server để chắc chắn đồng bộ
    refreshQuestions();
    loadAvailable();
  };

  // ─── Confirm delete ─────────────────────────────────────────────────────
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleting || deletingInProgress) return;
    setDeletingInProgress(true);
    try {
      const ok = await removeQuestion(deleting.id);
      if (ok) {
        setDeleting(null);
        // refresh available để cập nhật trạng thái "Đã thêm"
        loadAvailable();
      }
    } finally {
      setDeletingInProgress(false);
    }
  };

  // ─── Style helpers ──────────────────────────────────────────────────────

  const difficultyBadge = (d: string | null) => (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${difficultyColor(d)}`}
    >
      {difficultyLabel(d)}
    </span>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* ── Edit form (thay thế card khi đang sửa) ── */}
      {editingQuestion && (
        <EditQuestionForm
          meetingCode={meetingCode}
          question={editingQuestion}
          onSuccess={handleQuestionUpdated}
          onCancel={() => setEditingQuestion(null)}
          onDelete={() => setDeleting(editingQuestion)}
        />
      )}

      {/* ── Create form ── */}
      {!editingQuestion &&
        (showCreateForm ? (
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
        ))}

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
              const isEditing = editingQuestion?.id === q.id;
              return (
                <div
                  key={q.id}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg border transition-all group
                    ${
                      isActive
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-[#1e3a50] bg-[#0d2035] hover:border-cyan-500/50"
                    }
                  `}
                  onClick={() => !isEditing && handleSetActive(q)}
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

                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      className={`
                        px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                        ${
                          isActive
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
                      {settingId === q.id
                        ? "..."
                        : isActive
                          ? "Đang chọn"
                          : "Chọn"}
                    </button>

                    {/* Action group: Edit / Delete */}
                    <div
                      className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        title="Sửa câu hỏi"
                        className="flex-1 px-2 py-1 rounded-md bg-[#122131] hover:bg-[#1a3147] text-gray-400 hover:text-cyan-400 transition-colors border border-[#3b494b]"
                        onClick={() => {
                          updateQuestionLocal(q);
                          setEditingQuestion(q);
                          setShowCreateForm(false);
                        }}
                      >
                        <span className="material-symbols-outlined text-xs leading-none align-middle">
                          edit
                        </span>
                      </button>
                      <button
                        type="button"
                        title="Xoá khỏi buổi phỏng vấn"
                        className="flex-1 px-2 py-1 rounded-md bg-[#122131] hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors border border-[#3b494b]"
                        onClick={() => setDeleting(q)}
                      >
                        <span className="material-symbols-outlined text-xs leading-none align-middle">
                          delete
                        </span>
                      </button>
                    </div>
                  </div>
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
                    <span className="text-white text-sm truncate">
                      {q.title}
                    </span>
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
                  {addingId === q.id
                    ? "..."
                    : q.isAssigned
                      ? "Đã thêm"
                      : "+ Thêm"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Delete confirm modal ── */}
      {deleting && (
        <DeleteConfirm
          question={deleting}
          deleting={deletingInProgress}
          onConfirm={handleConfirmDelete}
          onCancel={() => !deletingInProgress && setDeleting(null)}
        />
      )}
    </div>
  );
}
