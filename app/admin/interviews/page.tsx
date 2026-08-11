"use client";

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

type InterviewRow = {
  id: string;
  title: string;
  meeting_code: string;
  status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";
  scheduled_at: string;
  duration_minutes: number;
  recruiter_email: string | null;
  recruiter_name: string | null;
};

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "SCHEDULED", label: "Đã lên lịch" },
  { value: "ONGOING", label: "Đang diễn ra" },
  { value: "FINISHED", label: "Hoàn thành" },
  { value: "CANCELLED", label: "Đã huỷ" },
];

const STATUS_COLOR: Record<InterviewRow["status"], string> = {
  SCHEDULED: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30",
  ONGOING: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  FINISHED: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
  CANCELLED: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
};

export default function AdminInterviewsPage() {
  const { ready } = useAdminGuard();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [rows, setRows] = useState<InterviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<InterviewRow | null>(null);
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
      const data = await fetchJson<Paginated<InterviewRow>>(
        `/api/admin/interviews?${params.toString()}`,
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

  const changeStatus = async (
    row: InterviewRow,
    newStatus: InterviewRow["status"],
  ) => {
    setBusyId(row.id);
    try {
      const res = await adminFetch("/api/admin/interviews", {
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

  const doDelete = async (row: InterviewRow) => {
    setBusyId(row.id);
    try {
      const res = await adminFetch(
        `/api/admin/interviews?id=${encodeURIComponent(row.id)}`,
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
          Quản lý buổi phỏng vấn
        </h1>
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

      <AdminTable<InterviewRow>
        rows={rows}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage="Không có buổi phỏng vấn nào."
        columns={[
          {
            key: "title",
            header: "Buổi phỏng vấn",
            width: "w-[340px]",
            render: (r) => (
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {r.title}
                </div>
                <div className="text-xs text-cyan-400 font-mono truncate">
                  {r.meeting_code}
                </div>
              </div>
            ),
          },
          {
            key: "host",
            header: "Chủ phòng",
            width: "w-64",
            render: (r) => (
              <div className="min-w-0">
                <div className="text-sm text-slate-200 truncate">
                  {r.recruiter_name || "—"}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {r.recruiter_email}
                </div>
              </div>
            ),
          },
          {
            key: "duration",
            header: "Thời lượng",
            width: "w-28",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <span className="text-sm text-slate-300">
                {r.duration_minutes} phút
              </span>
            ),
          },
          {
            key: "scheduled",
            header: "Lịch hẹn",
            width: "w-48",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <span className="text-xs text-slate-300 whitespace-nowrap">
                {r.scheduled_at
                  ? new Date(r.scheduled_at).toLocaleString("vi-VN")
                  : "—"}
              </span>
            ),
          },
          {
            key: "status",
            header: "Trạng thái",
            width: "w-40",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <select
                value={r.status}
                disabled={busyId === r.id}
                onChange={(e) =>
                  changeStatus(r, e.target.value as InterviewRow["status"])
                }
                className={`w-full px-2 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 ${STATUS_COLOR[r.status]}`}
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
            width: "w-28",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <div className="flex justify-center">
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
        title="Xoá buổi phỏng vấn?"
        description={`Buổi "${confirmDelete?.title}" sẽ bị ẩn khỏi hệ thống (xoá mềm).`}
        confirmText="Xoá"
        destructive
        loading={busyId === confirmDelete?.id}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
      />
    </AdminShell>
  );
}
