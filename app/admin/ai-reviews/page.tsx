"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, Eye, X } from "lucide-react";
import { AdminShell } from "@/app/components/admin-dashboard/AdminShell";
import { AdminTable } from "@/app/components/admin-dashboard/AdminTable";
import { AdminFilter } from "@/app/components/admin-dashboard/AdminFilter";
import { AdminPagination } from "@/app/components/admin-dashboard/AdminPagination";
import { ConfirmDialog } from "@/app/components/admin-dashboard/ConfirmDialog";
import { useAdminGuard } from "@/app/components/admin-dashboard/useAdminGuard";
import {
  adminFetch,
  fetchJson,
  type Paginated,
} from "@/app/components/admin-dashboard/api";

type AiReviewRow = {
  id: string;
  submission_id: string;
  score: number | null;
  correctness_score: number | null;
  algorithm_score: number | null;
  overall_score: number | null;
  correctness: string | null;
  algorithm: string | null;
  time_complexity: string | null;
  space_complexity: string | null;
  strengths: string | null;
  weaknesses: string | null;
  feedback: string | null;
  hint: string | null;
  model_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  candidate_name: string | null;
  language: string | null;
  question_id: string | null;
  question_title: string | null;
};

function scoreColor(score: number | null) {
  if (score === null || Number.isNaN(score)) return "text-slate-400";
  if (score >= 8) return "text-emerald-300";
  if (score >= 5) return "text-yellow-300";
  return "text-rose-300";
}

function truncate(text: string | null, len = 80) {
  if (!text) return "—";
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

export default function AdminAiReviewsPage() {
  const { ready } = useAdminGuard();
  const [search, setSearch] = useState("");
  const [modelName, setModelName] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [rows, setRows] = useState<AiReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AiReviewRow | null>(null);
  const [detailRow, setDetailRow] = useState<AiReviewRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set("q", search);
      if (modelName) params.set("model_name", modelName);
      if (minScore) params.set("min_score", minScore);
      if (maxScore) params.set("max_score", maxScore);
      const data = await fetchJson<Paginated<AiReviewRow>>(
        `/api/admin/ai-reviews?${params.toString()}`,
      );
      setRows(data.data);
      setTotal(data.pagination.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [ready, page, limit, search, modelName, minScore, maxScore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const doDelete = async (row: AiReviewRow) => {
    setBusyId(row.id);
    try {
      const res = await adminFetch(
        `/api/admin/ai-reviews?id=${encodeURIComponent(row.id)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Lỗi");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setTotal((t) => Math.max(0, t - 1));
      setConfirmDelete(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit],
  );

  if (!ready) {
    return (
      <AdminShell>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Quản lý AI Reviews</h1>
        <p className="mt-1 text-sm text-slate-400">
          Danh sách các đánh giá code do AI chấm cho từng bài nộp.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <AdminFilter
            search={search}
            onSearchChange={(v) => {
              setPage(1);
              setSearch(v);
            }}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-400 mb-1">Model</label>
          <input
            type="text"
            value={modelName}
            onChange={(e) => {
              setPage(1);
              setModelName(e.target.value);
            }}
            placeholder="vd: gpt-4o"
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 w-40"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-400 mb-1">Điểm tối thiểu</label>
          <input
            type="number"
            value={minScore}
            onChange={(e) => {
              setPage(1);
              setMinScore(e.target.value);
            }}
            placeholder="0"
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 w-24"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-400 mb-1">Điểm tối đa</label>
          <input
            type="number"
            value={maxScore}
            onChange={(e) => {
              setPage(1);
              setMaxScore(e.target.value);
            }}
            placeholder="10"
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 w-24"
          />
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <AdminTable<AiReviewRow>
        rows={rows}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage="Không có review nào."
        columns={[
          {
            key: "question",
            header: "Câu hỏi",
            render: (r) => (
              <div>
                <div className="text-sm text-white">
                  {r.question_title || "—"}
                </div>
                <div className="text-xs text-slate-400">
                  {r.candidate_name || "—"}
                  {r.language ? ` · ${r.language}` : ""}
                </div>
              </div>
            ),
          },
          {
            key: "model",
            header: "Model",
            render: (r) => (
              <span className="text-xs text-slate-300">
                {r.model_name || "—"}
              </span>
            ),
          },
          {
            key: "overall_score",
            header: "Điểm tổng",
            render: (r) => (
              <span
                className={`text-sm font-semibold ${scoreColor(r.overall_score)}`}
              >
                {r.overall_score ?? "—"}
              </span>
            ),
          },
          {
            key: "sub_scores",
            header: "Correctness / Algorithm",
            render: (r) => (
              <span className="text-xs text-slate-300">
                {r.correctness_score ?? "—"} / {r.algorithm_score ?? "—"}
              </span>
            ),
          },
          {
            key: "complexity",
            header: "Time / Space",
            render: (r) => (
              <span className="text-xs text-slate-300">
                {r.time_complexity || "—"} / {r.space_complexity || "—"}
              </span>
            ),
          },
          {
            key: "feedback",
            header: "Feedback",
            render: (r) => (
              <span
                className="text-xs text-slate-300 max-w-[240px] block"
                title={r.feedback || ""}
              >
                {truncate(r.feedback)}
              </span>
            ),
          },
          {
            key: "reviewed_at",
            header: "Chấm lúc",
            render: (r) => (
              <span className="text-xs text-slate-300">
                {r.reviewed_at
                  ? new Date(r.reviewed_at).toLocaleString("vi-VN")
                  : new Date(r.created_at).toLocaleString("vi-VN")}
              </span>
            ),
          },
          {
            key: "actions",
            header: "Hành động",
            render: (r) => (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailRow(r)}
                  className="px-2 py-1 rounded-lg border border-slate-700 hover:border-cyan-500 text-xs text-slate-200 flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" /> Xem
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => setConfirmDelete(r)}
                  className="px-2 py-1 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs flex items-center gap-1 disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" /> Xoá
                </button>
              </div>
            ),
          },
        ]}
      />

      <AdminPagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={limit}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Xoá review?"
        description={`Review của "${confirmDelete?.candidate_name || confirmDelete?.question_title || confirmDelete?.id}" sẽ bị xoá vĩnh viễn.`}
        confirmText="Xoá"
        destructive
        loading={busyId === confirmDelete?.id}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
      />

      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setDetailRow(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {detailRow.question_title || "Chi tiết review"}
                </h2>
                <p className="text-xs text-slate-400">
                  {detailRow.candidate_name || "—"}
                  {detailRow.language ? ` · ${detailRow.language}` : ""} ·{" "}
                  {detailRow.model_name || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
              <div className="rounded-lg border border-slate-700 p-3">
                <div className="text-slate-400 mb-1">Điểm tổng</div>
                <div
                  className={`text-base font-semibold ${scoreColor(detailRow.overall_score)}`}
                >
                  {detailRow.overall_score ?? "—"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <div className="text-slate-400 mb-1">Score gốc</div>
                <div className="text-base font-semibold text-slate-200">
                  {detailRow.score ?? "—"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <div className="text-slate-400 mb-1">Correctness</div>
                <div className="text-slate-200">
                  {detailRow.correctness_score ?? "—"} —{" "}
                  {detailRow.correctness || "—"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <div className="text-slate-400 mb-1">Algorithm</div>
                <div className="text-slate-200">
                  {detailRow.algorithm_score ?? "—"} —{" "}
                  {detailRow.algorithm || "—"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <div className="text-slate-400 mb-1">Time complexity</div>
                <div className="text-slate-200">
                  {detailRow.time_complexity || "—"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 p-3">
                <div className="text-slate-400 mb-1">Space complexity</div>
                <div className="text-slate-200">
                  {detailRow.space_complexity || "—"}
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-slate-400 mb-1">Feedback</div>
                <p className="text-slate-200 whitespace-pre-wrap">
                  {detailRow.feedback || "—"}
                </p>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Điểm mạnh</div>
                <p className="text-slate-200 whitespace-pre-wrap">
                  {detailRow.strengths || "—"}
                </p>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Điểm yếu</div>
                <p className="text-slate-200 whitespace-pre-wrap">
                  {detailRow.weaknesses || "—"}
                </p>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Gợi ý (hint)</div>
                <p className="text-slate-200 whitespace-pre-wrap">
                  {detailRow.hint || "—"}
                </p>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Submission ID: {detailRow.submission_id} · Chấm lúc:{" "}
              {detailRow.reviewed_at
                ? new Date(detailRow.reviewed_at).toLocaleString("vi-VN")
                : new Date(detailRow.created_at).toLocaleString("vi-VN")}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
