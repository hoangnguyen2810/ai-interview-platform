"use client";

// app/admin/ai-test-cases/page.tsx
//
// Trang quản lý AI-generated test cases, khớp 1-1 với
// GET/DELETE /api/admin/ai-test-cases (status, edge_case_type,
// submission_id, search, pagination).
//
// Giả định: Tailwind CSS đã cấu hình sẵn trong dự án (theo stack
// Next.js App Router bạn đang dùng). Không phụ thuộc thư viện UI
// ngoài React để tránh xung đột với bộ component sẵn có của bạn —
// nếu dự án đã có Button/Table/Badge riêng, thay các thẻ thô bên
// dưới bằng component đó là đủ.

import { useCallback, useEffect, useMemo, useState } from "react";
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

const STATUS_STYLE: Record<Status, string> = {
  PENDING: "bg-zinc-100 text-zinc-600 ring-zinc-300",
  PASSED: "bg-emerald-50 text-emerald-700 ring-emerald-300",
  FAILED: "bg-red-50 text-red-700 ring-red-300",
  RUNTIME_ERROR: "bg-amber-50 text-amber-700 ring-amber-300",
  TIMEOUT: "bg-violet-50 text-violet-700 ring-violet-300",
};

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

interface ListResponse {
  data: TestCaseRow[];
  pagination: { page: number; limit: number; total: number };
}

const LIMIT = 5;

export default function AiTestCasesAdminPage() {
  const [rows, setRows] = useState<TestCaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<string>("");
  const [edgeCaseType, setEdgeCaseType] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TestCaseRow | null>(null);

  const { ready } = useAdminGuard();

  // debounce ô tìm kiếm để không bắn request mỗi keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (status) params.set("status", status);
      if (edgeCaseType) params.set("edge_case_type", edgeCaseType);
      if (submissionId) params.set("submission_id", submissionId);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/ai-test-cases?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Không thể tải danh sách test case");
      const json: { data: ListResponse } | ListResponse = await res.json();
      const payload =
        "data" in json && "pagination" in json
          ? (json as ListResponse)
          : (json as any).data;
      setRows(payload.data);
      setTotal(payload.pagination.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đã có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }, [page, status, edgeCaseType, submissionId, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDelete(id: string) {
    if (!confirm("Xoá test case này? Hành động không thể hoàn tác.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/ai-test-cases?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Xoá thất bại");
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xoá thất bại");
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

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
      <div className="p-6 max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900">
            Test case do AI sinh ra
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Quản lý các test case được AI tự động tạo khi chấm bài nộp của ứng
            viên.
          </p>
        </header>

        {/* Bộ lọc */}

        <AdminFilter
          search={searchInput}
          onSearchChange={(v) => {
            setSearchInput(v);
            setPage(1);
          }}
          selects={[
            {
              value: status,
              onChange: (v) => {
                setStatus(v);
                setPage(1);
              },
              options: [
                { value: "", label: "Tất cả trạng thái" },
                ...STATUS_OPTIONS.map((s) => ({
                  value: s,
                  label: s,
                })),
              ],
            },
          ]}
        />

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <AdminTable<TestCaseRow>
            rows={rows}
            loading={loading}
            rowKey={(r) => r.id}
            emptyMessage="Không có test case."
            columns={[
              {
                key: "question",
                header: "Câu hỏi",
                render: (r) => (
                  <div>
                    <div className="text-sm text-white">
                      {r.question_title ?? "—"}
                    </div>
                    <div className="text-xs text-slate-400">
                      {r.question_id}
                    </div>
                  </div>
                ),
              },
              {
                key: "candidate",
                header: "Ứng viên",
                render: (r) => (
                  <div className="text-xs text-slate-300">
                    {r.candidate_name ?? "—"}
                  </div>
                ),
              },
              {
                key: "language",
                header: "Ngôn ngữ",
                render: (r) => (
                  <span className="text-sm text-slate-300">
                    {r.language ?? "—"}
                  </span>
                ),
              },
              {
                key: "edge",
                header: "Edge Case",
                render: (r) => (
                  <span className="text-sm text-slate-300">
                    {r.edge_case_type ?? "—"}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Trạng thái",
                render: (r) => (
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${STATUS_STYLE[r.status]}`}
                  >
                    {r.status}
                  </span>
                ),
              },
              {
                key: "runtime",
                header: "Runtime",
                render: (r) => (
                  <span className="text-sm text-slate-300">
                    {r.runtime_ms ?? "—"} ms
                  </span>
                ),
              },
              {
                key: "created",
                header: "Tạo lúc",
                render: (r) => (
                  <span className="text-xs text-slate-300">
                    {new Date(r.created_at).toLocaleString("vi-VN")}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "Hành động",
                render: (r) => (
                  <button
                    onClick={() => setConfirmDelete(r)}
                    className="px-2 py-1 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Xoá
                  </button>
                ),
              },
            ]}
          />
        </div>

        {/* Phân trang */}
        <AdminPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={LIMIT}
          onPageChange={setPage}
        />
        <ConfirmDialog
          open={!!confirmDelete}
          title="Xoá test case?"
          description={`Test case của "${confirmDelete?.question_title}" sẽ bị xoá.`}
          confirmText="Xoá"
          destructive
          loading={deletingId === confirmDelete?.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            if (confirmDelete) {
              handleDelete(confirmDelete.id);
              setConfirmDelete(null);
            }
          }}
        />
      </div>
    </AdminShell>
  );
}
