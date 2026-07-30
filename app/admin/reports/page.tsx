"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, Eye } from "lucide-react";
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

type ReportRow = {
  id: string;
  interview_id: string;
  status: "DRAFT" | "EDITED" | "FINAL";
  ai_overall_score: number | null;
  ai_model: string | null;
  generated_at: string;
  interview_title: string;
  meeting_code: string;
  created_by_name: string | null;
  created_by_email: string | null;
};

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "DRAFT", label: "DRAFT" },
  { value: "EDITED", label: "EDITED" },
  { value: "FINAL", label: "FINAL" },
];

const STATUS_COLOR: Record<ReportRow["status"], string> = {
  DRAFT: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30",
  EDITED: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30",
  FINAL: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
};

export default function AdminReportsPage() {
  const { ready } = useAdminGuard();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ReportRow | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
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
      if (status) params.set("status", status);
      const data = await fetchJson<Paginated<ReportRow>>(
        `/api/admin/reports?${params.toString()}`,
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
  }, [ready, page, limit, search, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openPreview = async (id: string) => {
    setPreviewId(id);
    setPreview(null);
    setPreviewLoading(true);
    try {
      const res = await adminFetch(`/api/admin/reports/${id}`);
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Lỗi");
      setPreview(data.report);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi");
      setPreviewId(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const changeStatus = async (
    row: ReportRow,
    newStatus: ReportRow["status"],
  ) => {
    setBusyId(row.id);
    try {
      const res = await adminFetch("/api/admin/reports", {
        method: "PATCH",
        body: JSON.stringify({ id: row.id, status: newStatus }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Lỗi");
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: newStatus } : r)),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (row: ReportRow) => {
    setBusyId(row.id);
    try {
      const res = await adminFetch(
        `/api/admin/reports?id=${encodeURIComponent(row.id)}`,
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
        <h1 className="text-2xl font-bold text-white">
          Quản lý báo cáo đánh giá
        </h1>
        <p className="mt-1 text-sm text-slate-400">Xem nội dung các báo cáo</p>
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
            options: STATUS_OPTIONS,
          },
        ]}
      />

      {error && (
        <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <AdminTable<ReportRow>
        rows={rows}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage="Không có report nào."
        columns={[
          {
            key: "title",
            header: "Phỏng vấn",
            render: (r) => (
              <div>
                <div className="text-sm text-white">{r.interview_title}</div>
                <div className="text-xs text-slate-400">{r.meeting_code}</div>
              </div>
            ),
          },
          {
            key: "score",
            header: "AI Score",
            render: (r) =>
              r.ai_overall_score != null ? (
                <span className="text-sm font-semibold text-cyan-300">
                  {r.ai_overall_score.toFixed(1)} / 10
                </span>
              ) : (
                <span className="text-xs text-slate-500">—</span>
              ),
          },
          {
            key: "model",
            header: "Model",
            render: (r) => (
              <span className="text-xs text-slate-300">
                {r.ai_model || "—"}
              </span>
            ),
          },
          {
            key: "creator",
            header: "Người tạo",
            render: (r) => (
              <span className="text-xs text-slate-300">
                {r.created_by_name || "—"}
              </span>
            ),
          },
          {
            key: "generated",
            header: "Tạo lúc",
            render: (r) => (
              <span className="text-xs text-slate-300">
                {new Date(r.generated_at).toLocaleString("vi-VN")}
              </span>
            ),
          },
          {
            key: "status",
            header: "Trạng thái",
            render: (r) => (
              <select
                value={r.status}
                disabled={busyId === r.id}
                onChange={(e) =>
                  changeStatus(r, e.target.value as ReportRow["status"])
                }
                className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[r.status]}`}
              >
                {STATUS_OPTIONS.filter((o) => o.value).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ),
          },
          {
            key: "actions",
            header: "Hành động",
            render: (r) => (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPreview(r.id)}
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
        title="Xoá report?"
        description={`Report của "${confirmDelete?.interview_title}" sẽ bị ẩn khỏi hệ thống (xoá mềm).`}
        confirmText="Xoá"
        destructive
        loading={busyId === confirmDelete?.id}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
      />

      {previewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0B1120] border border-white/10 rounded-2xl p-8 shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-on-surface">
                Nội dung report
              </h2>
              <button
                type="button"
                onClick={() => setPreviewId(null)}
                className="material-symbols-outlined text-on-surface-variant"
              >
                close
              </button>
            </div>
            {previewLoading ? (
              <p className="text-sm text-slate-400">Đang tải…</p>
            ) : (
              <pre className="text-xs text-slate-200 bg-[#071524] rounded-lg p-4 overflow-x-auto">
                {JSON.stringify(preview, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
