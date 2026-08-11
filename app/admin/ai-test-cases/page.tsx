"use client";

// app/admin/ai-test-cases/page.tsx
//
// Trang quản lý AI-generated test cases, khớp 1-1 với
// GET/DELETE /api/admin/ai-test-cases (status, edge_case_type,
// search, pagination).
//
// Đã đồng bộ UI/UX với trang "Kho câu hỏi lập trình"
// (app/admin/questions/page.tsx): cùng dark theme, cùng cách bố cục
// header, filter, bảng, phân trang, và cùng dùng adminFetch/fetchJson
// thay vì gọi fetch trực tiếp.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

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

const STATUS_OPTIONS = [
  "PENDING",
  "PASSED",
  "FAILED",
  "RUNTIME_ERROR",
  "TIMEOUT",
] as const;

type Status = (typeof STATUS_OPTIONS)[number];

// Cùng "họ" màu badge với DIFFICULTY_COLOR ở trang questions
// (nền /15, chữ /300, viền /30) để hai trang admin nhất quán.
const STATUS_COLOR: Record<Status, string> = {
  PENDING: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
  PASSED: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  FAILED: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
  RUNTIME_ERROR: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  TIMEOUT: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
};

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
];

const EDGE_CASE_OPTIONS = [
  { value: "", label: "Tất cả edge case" },
  { value: "BOUNDARY", label: "BOUNDARY" },
  { value: "NULL_EMPTY", label: "NULL_EMPTY" },
  { value: "LARGE_INPUT", label: "LARGE_INPUT" },
  { value: "NEGATIVE", label: "NEGATIVE" },
  { value: "TYPICAL", label: "TYPICAL" },
];

interface TestCaseRow {
  id: string;
  submission_id: string;
  input_data: string | null;
  expected_output: string | null;
  description: string | null;
  edge_case_type: string | null;
  status: Status;
  actual_output: string | null;
  runtime_ms: number | null;
  execution_order: number | null;
  created_at: string;
  candidate_name: string | null;
  language: string | null;
  question_id: string | null;
  question_title: string | null;
}

const LIMIT = 20;

export default function AiTestCasesAdminPage() {
  const { ready } = useAdminGuard();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [edgeCaseType, setEdgeCaseType] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(LIMIT);

  const [rows, setRows] = useState<TestCaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TestCaseRow | null>(null);
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
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (edgeCaseType) params.set("edge_case_type", edgeCaseType);
      const data = await fetchJson<Paginated<TestCaseRow>>(
        `/api/admin/ai-test-cases?${params.toString()}`,
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
  }, [ready, page, limit, search, status, edgeCaseType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const doDelete = async (r: TestCaseRow) => {
    setBusyId(r.id);
    try {
      const res = await adminFetch(
        `/api/admin/ai-test-cases?id=${encodeURIComponent(r.id)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Lỗi");
      setRows((prev) => prev.filter((row) => row.id !== r.id));
      setTotal((t) => Math.max(0, t - 1));
      setConfirmDelete(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

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
        <h1 className="text-2xl font-bold text-white">
          Test case do AI sinh ra
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Các test case được AI tự động tạo khi chấm bài nộp của ứng viên
        </p>
      </div>

      <AdminFilter
        search={search}
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        selects={[
          {
            value: status,
            onChange: (v) => {
              setPage(1);
              setStatus(v);
            },
            options: STATUS_FILTER_OPTIONS,
          },
          {
            value: edgeCaseType,
            onChange: (v) => {
              setPage(1);
              setEdgeCaseType(v);
            },
            options: EDGE_CASE_OPTIONS,
          },
        ]}
      />

      {error && (
        <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <AdminTable<TestCaseRow>
        rows={rows}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage="Không có test case."
        columns={[
          {
            key: "question",
            header: "Câu hỏi",
            width: "w-[320px]",
            render: (r) => (
              <div className="min-w-0">
                <div
                  className="text-sm font-medium text-white truncate"
                  title={r.question_title || ""}
                >
                  {r.question_title ?? "—"}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {r.question_id ?? "—"}
                </div>
              </div>
            ),
          },
          {
            key: "candidate",
            header: "Ứng viên",
            width: "w-40",
            render: (r) => (
              <span
                className="text-sm text-slate-300 truncate block"
                title={r.candidate_name || ""}
              >
                {r.candidate_name ?? "—"}
              </span>
            ),
          },
          {
            key: "language",
            header: "Ngôn ngữ",
            width: "w-28",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <span className="text-sm text-slate-300">
                {r.language ?? "—"}
              </span>
            ),
          },
          {
            key: "edge",
            header: "Edge Case",
            width: "w-32",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <span className="text-sm text-slate-300">
                {r.edge_case_type ?? "—"}
              </span>
            ),
          },
          {
            key: "status",
            header: "Trạng thái",
            width: "w-32",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <span
                className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[r.status]}`}
              >
                {r.status}
              </span>
            ),
          },
          {
            key: "runtime",
            header: "Runtime",
            width: "w-24",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <span className="text-sm text-slate-300">
                {r.runtime_ms ?? "—"} ms
              </span>
            ),
          },
          {
            key: "created",
            header: "Tạo lúc",
            width: "w-48",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <span className="text-xs text-slate-300 whitespace-nowrap">
                {new Date(r.created_at).toLocaleString("vi-VN")}
              </span>
            ),
          },
          {
            key: "actions",
            header: "Hành động",
            width: "w-28",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => setConfirmDelete(r)}
                  className="px-2 py-1 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs flex items-center gap-1 disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  Xóa
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
        title="Xoá test case?"
        description={`Test case của "${confirmDelete?.question_title ?? "câu hỏi này"}" sẽ bị xoá.`}
        confirmText="Xoá"
        destructive
        loading={busyId === confirmDelete?.id}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
      />
    </AdminShell>
  );
}
