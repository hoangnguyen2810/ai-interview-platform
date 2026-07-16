"use client";

import { useEffect, useState, useCallback } from "react";
import TestCaseEditorModal from "./TestCaseEditorModal";

interface Review {
  reviewId: string;
  overallScore: number;
  correctnessScore: number;
  algorithmScore: number;
  timeComplexity: string;
  spaceComplexity: string;
  correctness: string;
  algorithm: string;
  strengths: string;
  weaknesses: string;
  hint: string;
  // New fields from the refactored analyzer/reviewer pipeline.
  executionMode?: "stdin" | "hardcoded" | "function" | "unknown";
  analysisReason?: string;
  analysisConfidence?: number | null;
  analysisEntryPoint?: string;
  usesHardcodedValues?: boolean;
  canAutoRun?: boolean;
}

interface AITestCase {
  id: string;
  description: string;
  edgeCaseType: string;
  inputData: string;
  expectedOutput: string;
  actualOutput: string;
  status: "PENDING" | "PASSED" | "FAILED" | "RUNTIME_ERROR" | "TIMEOUT";
  runtimeMs: number;
  source?: "AI" | "MANUAL";
  aiVerified?: boolean | null;
}

interface Submission {
  submissionId: string;
  questionId: string;
  language: string;
  sourceCode: string;
  stdout: string;
  stderr: string;
  runtimeMs: number;
  exitCode: number;
  status: string;
  success: boolean;
  createdAt: string;
  candidateId: string;
  candidateName: string | null;
}

interface ReviewPayload {
  review: Review | null;
  tests: { total: number; passed: number; items: AITestCase[] };
}

const STATUS_COLORS: Record<string, string> = {
  PASSED: "bg-green-500/20 text-green-300 border-green-500/40",
  FAILED: "bg-red-500/20 text-red-300 border-red-500/40",
  RUNTIME_ERROR: "bg-red-500/20 text-red-300 border-red-500/40",
  TIMEOUT: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  PENDING: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  ACCEPTED: "bg-green-500/20 text-green-300 border-green-500/40",
  RUNTIME_ERROR_SUB: "bg-red-500/20 text-red-300 border-red-500/40",
  COMPILE_ERROR: "bg-red-500/20 text-red-300 border-red-500/40",
  WRONG_ANSWER: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  SYSTEM_ERROR: "bg-gray-500/20 text-gray-300 border-gray-500/40",
};

const MODE_LABEL: Record<string, string> = {
  stdin: "Đọc stdin/stdout",
  hardcoded: "Hardcode giá trị",
  function: "Chỉ định nghĩa hàm",
  unknown: "Không xác định được",
};

/** Safely parse JSON; returns fallback when response is empty or non-JSON
 *  (e.g. proxy returned an HTML 404 page or empty 204). */
async function readJson<T>(res: Response, fallback: T): Promise<T> {
  try {
    const text = await res.text();
    if (!text) return fallback;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("application/json")) {
      console.warn(
        `[AIReviewList] non-JSON response ${res.status} ct=${ct}: ${text.slice(0, 120)}`,
      );
      return fallback;
    }
    return JSON.parse(text) as T;
  } catch (e) {
    console.warn("[AIReviewList] readJson parse failed:", e);
    return fallback;
  }
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(10, value)) * 10;
  const color =
    value >= 8
      ? "bg-green-500"
      : value >= 6
        ? "bg-cyan-500"
        : value >= 4
          ? "bg-yellow-500"
          : "bg-red-500";

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-[#c4c4c4] mb-1">
        <span>{label}</span>
        <span className="font-mono">{value.toFixed(1)}/10</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CorrectnessBadge({ value }: { value: string }) {
  const cls =
    value === "PASS"
      ? "text-green-400 bg-green-500/10 border-green-500/30"
      : value === "PARTIAL"
        ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
        : value === "FAIL"
          ? "text-red-400 bg-red-500/10 border-red-500/30"
          : "text-gray-300 bg-gray-500/10 border-gray-500/30";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>
      {value === "CANNOT_RUN" ? "Không thể chạy tự động" : value}
    </span>
  );
}

interface Props {
  meetingCode: string;
}

export default function AIReviewList({ meetingCode }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ReviewPayload | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  // Role-gated UI: hide Edit/Run affordances from candidates.
  const [isRecruiter, setIsRecruiter] = useState(false);

  // Editor modal state.
  const [editingTest, setEditingTest] = useState<AITestCase | null>(null);
  const [runningTestIds, setRunningTestIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => readJson<{ user?: { role?: string } | null }>(r, { user: null }))
      .then((data) => {
        if (cancelled) return;
        const role = data.user?.role ?? "";
        setIsRecruiter(role === "RECRUITER" || role === "ADMIN");
      })
      .catch(() => {
        if (!cancelled) setIsRecruiter(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/submissions`,
        { credentials: "include" },
      );
      const data = await readJson<{ success?: boolean; submissions?: Submission[]; message?: string }>(
        res,
        { success: false, submissions: [] },
      );
      if (data.success) {
        const list = data.submissions ?? [];
        setSubmissions(list);
        setSelectedId((cur) => cur ?? list[0]?.submissionId ?? null);
      } else {
        console.warn("[AIReviewList] submissions load non-ok:", res.status, data.message);
      }
    } catch (e) {
      console.warn("[AIReviewList] loadSubmissions failed:", e);
    } finally {
      setLoading(false);
    }
  }, [meetingCode]);

  const loadReview = useCallback(
    async (submissionId: string) => {
      setLoadingReview(true);
      try {
        const res = await fetch(
          `/api/interviews/${encodeURIComponent(
            meetingCode,
          )}/code-review?submissionId=${submissionId}`,
          { credentials: "include" },
        );
        const data = await readJson<{
          success?: boolean;
          review?: Review | null;
          tests?: { total: number; passed: number; items: AITestCase[] };
          message?: string;
        }>(res, { success: false });
        if (data.success) {
          setReviewData({
            review: data.review ?? null,
            tests: data.tests ?? { total: 0, passed: 0, items: [] },
          });
        } else {
          console.warn("[AIReviewList] review load non-ok:", res.status);
          setReviewData({ review: null, tests: { total: 0, passed: 0, items: [] } });
        }
      } catch (e) {
        console.warn("[AIReviewList] loadReview failed:", e);
      } finally {
        setLoadingReview(false);
      }
    },
    [meetingCode],
  );

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  useEffect(() => {
    if (selectedId) loadReview(selectedId);
  }, [selectedId, loadReview]);

  const triggerReview = async (submissionId: string) => {
    setTriggering(true);
    setTriggerError(null);
    try {
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/code-review`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionId }),
        },
      );
      const data = await readJson<{
        success?: boolean;
        review?: Review;
        aiTests?: { total: number; passed: number; items: AITestCase[] };
        message?: string;
      }>(res, { success: false });
      if (data.success) {
        setReviewData({
          review: data.review ?? null,
          tests: data.aiTests ?? { total: 0, passed: 0, items: [] },
        });
        await loadSubmissions();
      } else {
        setTriggerError(data?.message ?? `AI review thất bại (HTTP ${res.status})`);
      }
    } catch (e) {
      setTriggerError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setTriggering(false);
    }
  };

  const selected = submissions.find((s) => s.submissionId === selectedId);

  const runTests = useCallback(
    async (submissionId: string, testIds: string[]) => {
      if (testIds.length === 0) return;
      setActionError(null);
      setRunningTestIds((prev) => {
        const next = new Set(prev);
        testIds.forEach((id) => next.add(id));
        return next;
      });
      try {
        const res = await fetch(
          `/api/interviews/${encodeURIComponent(meetingCode)}/ai-tests`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "run",
              submissionId,
              testIds,
            }),
          },
        );
        const data = await readJson<{ success?: boolean; message?: string }>(
          res,
          { success: false },
        );
        if (!data.success) {
          setActionError(data.message ?? `Chạy thất bại (HTTP ${res.status})`);
        }
        await loadReview(submissionId);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Lỗi không xác định");
      } finally {
        setRunningTestIds((prev) => {
          const next = new Set(prev);
          testIds.forEach((id) => next.delete(id));
          return next;
        });
      }
    },
    [meetingCode, loadReview],
  );

  const handleEditorSave = useCallback(
    async (id: string, patch: {
      inputData: string;
      expectedOutput: string;
      description: string;
      edgeCaseType: string;
    }) => {
      if (!selected) return;
      setActionError(null);
      try {
        const res = await fetch(
          `/api/interviews/${encodeURIComponent(meetingCode)}/ai-tests`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id,
              submissionId: selected.submissionId,
              inputData: patch.inputData,
              expectedOutput: patch.expectedOutput,
              description: patch.description,
              edgeCaseType: patch.edgeCaseType,
            }),
          },
        );
        const data = await readJson<{ success?: boolean; message?: string }>(
          res,
          { success: false },
        );
        if (!data.success) {
          setActionError(data.message ?? `Lưu thất bại (HTTP ${res.status})`);
          return;
        }
        setEditingTest(null);
        await loadReview(selected.submissionId);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Lỗi không xác định");
      }
    },
    [meetingCode, loadReview, selected],
  );

  const handleEditorDelete = useCallback(
    async (id: string) => {
      if (!selected) return;
      setActionError(null);
      try {
        const res = await fetch(
          `/api/interviews/${encodeURIComponent(meetingCode)}/ai-tests?id=${id}&submissionId=${selected.submissionId}`,
          { method: "DELETE", credentials: "include" },
        );
        const data = await readJson<{ success?: boolean; message?: string }>(
          res,
          { success: false },
        );
        if (!data.success) {
          setActionError(data.message ?? `Xoá thất bại (HTTP ${res.status})`);
          return;
        }
        setEditingTest(null);
        await loadReview(selected.submissionId);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Lỗi không xác định");
      }
    },
    [meetingCode, loadReview, selected],
  );

  return (
    <div className="flex h-full">
      {/* Left: submission list */}
      <div className="w-1/3 border-r border-[#2a2a2a] flex flex-col shrink-0">
        <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center justify-between">
          <span className="text-[11px] text-[#9a9a9a] uppercase tracking-wider">
            Submissions ({submissions.length})
          </span>
          <button
            onClick={loadSubmissions}
            title="Refresh"
            className="text-[#9a9a9a] hover:text-[#e4e4e4] text-xs"
          >
            ↻
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-[11px] text-[#6e6e6e] py-4">
              Đang tải…
            </p>
          ) : submissions.length === 0 ? (
            <p className="text-center text-[11px] text-[#6e6e6e] py-4 px-3">
              Chưa có submission nào
            </p>
          ) : (
            submissions.map((s) => (
              <button
                key={s.submissionId}
                onClick={() => setSelectedId(s.submissionId)}
                className={`w-full text-left px-3 py-2 border-b border-[#222] transition-colors ${
                  selectedId === s.submissionId
                    ? "bg-[#1a2030]"
                    : "hover:bg-[#1f1f1f]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12.5px] text-[#e4e4e4] truncate font-medium">
                    {s.candidateName || "Candidate"}
                  </p>
                  <span
                    className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${
                      STATUS_COLORS[s.status] ?? STATUS_COLORS.SYSTEM_ERROR
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                <p className="text-[10.5px] text-[#6e6e6e] truncate mt-0.5">
                  {s.language} · {s.runtimeMs ?? 0}ms ·{" "}
                  {new Date(s.createdAt).toLocaleTimeString("vi-VN")}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: review */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-[11.5px] text-[#6e6e6e]">
            Chọn submission để xem review
          </div>
        ) : (
          <>
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center justify-between shrink-0">
              <div>
                <p className="text-[12.5px] text-[#e4e4e4] font-medium">
                  {selected.candidateName || "Candidate"} ·{" "}
                  <span className="text-[#9a9a9a] font-normal">
                    {selected.language}
                  </span>
                </p>
                <p className="text-[10.5px] text-[#6e6e6e] mt-0.5">
                  {new Date(selected.createdAt).toLocaleString("vi-VN")}
                </p>
              </div>
              <button
                onClick={() => triggerReview(selected.submissionId)}
                disabled={triggering}
                className="text-[11px] px-2.5 py-1 rounded bg-[#3b82f6] text-white hover:bg-[#2f6fe0] disabled:opacity-50 flex items-center gap-1"
              >
                {triggering ? "..." : "🤖 Review lại"}
              </button>
            </div>

            {triggerError && (
              <div className="mx-3 mt-2 px-2.5 py-1.5 rounded bg-red-900/40 border border-red-800 text-[11px] text-red-300 flex items-start justify-between gap-2">
                <span>{triggerError}</span>
                <button
                  onClick={() => setTriggerError(null)}
                  className="text-red-300/80 hover:text-red-200 underline shrink-0"
                >
                  đóng
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 custom-scrollbar">
              {loadingReview ? (
                <p className="text-center text-[11.5px] text-[#6e6e6e]">
                  Đang tải review…
                </p>
              ) : !reviewData?.review ? (
                <div className="text-center py-8">
                  <p className="text-[12px] text-[#9a9a9a] mb-2">
                    Chưa có AI review cho submission này
                  </p>
                  <button
                    onClick={() => triggerReview(selected.submissionId)}
                    disabled={triggering}
                    className="text-[11px] px-3 py-1.5 rounded bg-[#3b82f6] text-white hover:bg-[#2f6fe0] disabled:opacity-50"
                  >
                    {triggering ? "Đang chạy…" : "Chạy AI Review"}
                  </button>
                </div>
              ) : (
                <ReviewContent
                  review={reviewData.review}
                  tests={reviewData.tests}
                  isRecruiter={isRecruiter}
                  runningTestIds={runningTestIds}
                  actionError={actionError}
                  dismissActionError={() => setActionError(null)}
                  onEdit={(t) => setEditingTest(t)}
                  onRun={(testIds) => runTests(selected.submissionId, testIds)}
                />
              )}
            </div>
          </>
        )}
      </div>

      {editingTest && selected && (
        <TestCaseEditorModal
          meetingCode={meetingCode}
          submissionId={selected.submissionId}
          test={editingTest}
          onClose={() => setEditingTest(null)}
          onSave={handleEditorSave}
          onDelete={handleEditorDelete}
        />
      )}
    </div>
  );
}

function ReviewContent({
  review,
  tests,
  isRecruiter,
  runningTestIds,
  actionError,
  dismissActionError,
  onEdit,
  onRun,
}: {
  review: Review;
  tests: { total: number; passed: number; items: AITestCase[] };
  isRecruiter: boolean;
  runningTestIds: Set<string>;
  actionError: string | null;
  dismissActionError: () => void;
  onEdit: (t: AITestCase) => void;
  onRun: (testIds: string[]) => void;
}) {
  const mode = review.executionMode ?? "unknown";
  const canAutoRun = review.canAutoRun ?? mode === "stdin";
  // After removing auto-run, all test cases need recruiter to run manually.
  const showCannotRunBanner = true;

  return (
    <>
      {/* Execution-mode banner */}
      <div className="flex items-center justify-between gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10.5px] text-[#9a9a9a] uppercase tracking-wider shrink-0">
            Execution mode
          </span>
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded border ${
              mode === "stdin"
                ? "border-green-500/40 text-green-300 bg-green-500/10"
                : mode === "hardcoded"
                  ? "border-orange-500/40 text-orange-300 bg-orange-500/10"
                  : mode === "function"
                    ? "border-purple-500/40 text-purple-300 bg-purple-500/10"
                    : "border-gray-500/40 text-gray-300 bg-gray-500/10"
            }`}
          >
            {MODE_LABEL[mode] ?? mode}
          </span>
        </div>
        <span className="text-[10.5px] text-[#6e6e6e] shrink-0">
          {review.analysisConfidence != null
            ? `confidence ${Math.round(review.analysisConfidence * 100)}%`
            : ""}
        </span>
      </div>

      {showCannotRunBanner && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2.5 text-[11.5px] text-yellow-200 leading-relaxed">
          <p className="font-medium mb-1">Không thể tự động chạy chương trình</p>
          <p className="text-yellow-200/80">
            {review.analysisReason ||
              "AI không xác định được giao diện đầu vào của source code."}
            {review.analysisEntryPoint ? (
              <>
                {" "}
                <span className="opacity-80">Entry point: {review.analysisEntryPoint}</span>
              </>
            ) : null}
          </p>
        </div>
      )}

      {actionError && (
        <div className="px-2.5 py-1.5 rounded bg-red-900/40 border border-red-800 text-[11px] text-red-300 flex items-start justify-between gap-2">
          <span>{actionError}</span>
          <button
            onClick={dismissActionError}
            className="text-red-300/80 hover:text-red-200 underline shrink-0"
          >
            đóng
          </button>
        </div>
      )}

      {/* Overall */}
      <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10.5px] text-[#9a9a9a]">Overall Score</p>
            <p className="text-3xl font-bold text-cyan-300">
              {review.overallScore.toFixed(1)}
              <span className="text-sm text-[#6e6e6e]">/10</span>
            </p>
          </div>
          <div className="text-right text-[10.5px] space-y-1">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[#9a9a9a]">Correctness:</span>
              <CorrectnessBadge value={review.correctness} />
            </div>
            <p className="text-[#9a9a9a]">
              AI Tests:{" "}
              <span className="text-[#e4e4e4]">
                {tests.passed}/{tests.total}
              </span>
              {tests.items.some((t) => t.status === "PENDING") && (
                <span className="ml-1 text-[#9a9a9a]">· {tests.items.filter((t) => t.status === "PENDING").length} chờ chạy</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Score bars */}
      <div className="space-y-2 bg-white/5 rounded-lg p-3">
        <ScoreBar label="Correctness" value={review.correctnessScore} />
        <ScoreBar label="Algorithm" value={review.algorithmScore} />
      </div>

      {/* Complexity */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/5 rounded p-2">
          <p className="text-[10px] text-[#6e6e6e]">Time</p>
          <p className="text-cyan-300 font-mono text-[12px] mt-0.5">
            {review.timeComplexity}
          </p>
        </div>
        <div className="bg-white/5 rounded p-2">
          <p className="text-[10px] text-[#6e6e6e]">Space</p>
          <p className="text-cyan-300 font-mono text-[12px] mt-0.5">
            {review.spaceComplexity}
          </p>
        </div>
      </div>

      {/* Algorithm */}
      {review.algorithm && (
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-[10.5px] text-[#9a9a9a] mb-1">
            Algorithm evaluation
          </p>
          <p className="text-[12px] text-[#dcdcdc] leading-5 whitespace-pre-wrap">
            {review.algorithm}
          </p>
        </div>
      )}

      {/* Strengths / weaknesses */}
      <div className="grid gap-2">
        {review.strengths && (
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-2.5">
            <p className="text-[10.5px] text-green-400 mb-1">Strengths</p>
            <p className="text-[12px] text-[#dcdcdc] leading-5">
              {review.strengths}
            </p>
          </div>
        )}
        {review.weaknesses && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2.5">
            <p className="text-[10.5px] text-red-400 mb-1">Weaknesses</p>
            <p className="text-[12px] text-[#dcdcdc] leading-5">
              {review.weaknesses}
            </p>
          </div>
        )}
      </div>

      {/* Hint */}
      {review.hint && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2.5">
          <p className="text-[10.5px] text-purple-300 mb-1">
            Đề xuất hướng giải
          </p>
          <p className="text-[12px] text-[#e4e4e4] leading-5 whitespace-pre-wrap">
            {review.hint}
          </p>
        </div>
      )}

      {/* AI test cases */}
      {tests.items.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 mt-2">
            <p className="text-[10.5px] text-[#9a9a9a] uppercase tracking-wider">
              AI-generated test cases ({tests.total} test{tests.total !== 1 ? "s" : ""} · chờ recruiter chạy)
            </p>
            {isRecruiter && tests.items.length > 0 && (
              <button
                onClick={() => onRun(tests.items.map((t) => t.id))}
                disabled={[...runningTestIds].some((id) =>
                  tests.items.some((t) => t.id === id),
                )}
                className="text-[10.5px] px-2 py-0.5 rounded bg-[#3b82f6] text-white hover:bg-[#2f6fe0] disabled:opacity-50"
              >
                Chạy tất cả
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {tests.items.map((t) => {
              const isRunning = runningTestIds.has(t.id);
              return (
                <div
                  key={t.id}
                  className={`rounded border p-2 ${
                    STATUS_COLORS[t.status] ?? STATUS_COLORS.PENDING
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-medium">
                        {t.description || `Test ${t.id.slice(0, 6)}`}
                      </p>
                      <p className="text-[10px] opacity-70 mt-0.5">
                        edge: {t.edgeCaseType} ·{" "}
                        {t.status === "PENDING" ? "chưa chạy" : `${t.runtimeMs}ms`}
                        {t.source === "MANUAL" ? " · recruiter tạo" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-current">
                        {t.status}
                      </span>
                      {t.source !== "MANUAL" && (
                        t.aiVerified === true ? (
                          <span
                            title="AI đã tự kiểm: test PASS ngay lần chạy đầu tiên với code ứng viên."
                            className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/60 text-emerald-300 bg-emerald-500/10"
                          >
                            AI ✓
                          </span>
                        ) : t.aiVerified === false ? (
                          <span
                            title="AI không tự kiểm được: test FAILED / RUNTIME_ERROR / TIMEOUT ở lần chạy đầu. Cần recruiter xem lại input hoặc expected output."
                            className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/60 text-amber-300 bg-amber-500/10"
                          >
                            Cần xem
                          </span>
                        ) : (
                          <span
                            title="Test chưa được chạy tự động (chế độ không-stdin hoặc chưa auto-run)."
                            className="text-[10px] px-1.5 py-0.5 rounded border border-current opacity-60"
                          >
                            AI —
                          </span>
                        )
                      )}
                      {isRecruiter && (
                        <>
                          <button
                            onClick={() => onRun([t.id])}
                            disabled={isRunning}
                            title="Chạy thử test này"
                            className="text-[10px] px-1.5 py-0.5 rounded border border-current opacity-80 hover:opacity-100 disabled:opacity-40"
                          >
                            {isRunning ? "..." : "Run"}
                          </button>
                          <button
                            onClick={() => onEdit(t)}
                            title="Chỉnh sửa test"
                            className="text-[10px] px-1.5 py-0.5 rounded border border-current opacity-80 hover:opacity-100"
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <details className="text-[10.5px] mt-1">
                    <summary className="cursor-pointer opacity-80 hover:opacity-100">
                      Show I/O
                    </summary>
                    <div className="mt-1 space-y-1 font-mono">
                      <p>
                        <span className="opacity-60">Input:</span>
                        <pre className="bg-black/30 rounded p-1.5 mt-0.5 overflow-x-auto whitespace-pre-wrap">
                          {/* AITestCase doesn't carry input in this list; we render Expected/Actual only. */}
                          {"(xem editor)"}
                        </pre>
                      </p>
                      <p>
                        <span className="opacity-60">Expected:</span>
                        <pre className="bg-black/30 rounded p-1.5 mt-0.5 overflow-x-auto whitespace-pre-wrap">
                          {t.expectedOutput || "(empty)"}
                        </pre>
                      </p>
                      <p>
                        <span className="opacity-60">Actual:</span>
                        <pre className="bg-black/30 rounded p-1.5 mt-0.5 overflow-x-auto whitespace-pre-wrap">
                          {t.actualOutput || "(empty)"}
                        </pre>
                      </p>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}