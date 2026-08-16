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

type RecordingRow = {
  id: string;
  interview_id: string | null;
  interview_title: string | null;
  call_cid: string;
  filename: string | null;
  url: string;
  duration: number;
  recording_type: string | null;
  created_at: string;
};

function formatDuration(s: number) {
  if (!s || s < 0) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function AdminRecordingsPage() {
  const { ready } = useAdminGuard();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [rows, setRows] = useState<RecordingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RecordingRow | null>(null);
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
      const data = await fetchJson<Paginated<RecordingRow>>(
        `/api/admin/recordings?${params.toString()}`,
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
  }, [ready, page, limit, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const doDelete = async (row: RecordingRow) => {
    setBusyId(row.id);
    try {
      const res = await adminFetch(
        `/api/admin/recordings?id=${encodeURIComponent(row.id)}`,
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
        <h1 className="text-2xl font-bold text-white">Quản lý bản ghi hình</h1>
        <p className="mt-1 text-sm text-slate-400">
          Danh sách các bản ghi hình được tạo từ các buổi phỏng vấn.
        </p>
      </div>

      <AdminFilter
        search={search}
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
      />

      {error && (
        <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <AdminTable<RecordingRow>
        rows={rows}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage="Không có bản ghi nào."
        columns={[
          {
            key: "title",
            header: "Bản ghi",
            width: "w-[340px]",
            render: (r) => (
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {r.interview_title || "—"}
                </div>
                <div
                  className="text-xs text-slate-400 truncate"
                  title={r.filename || ""}
                >
                  {r.filename || "—"}
                </div>
              </div>
            ),
          },
          {
            key: "meeting",
            header: "Mã phòng",
            width: "w-44",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <span className="font-mono text-xs text-cyan-300 truncate">
                {r.call_cid}
              </span>
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
                {formatDuration(r.duration)}
              </span>
            ),
          },
          {
            key: "recording_type",
            header: "Loại",
            width: "w-32",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                {r.recording_type || "—"}
              </span>
            ),
          },
          {
            key: "created",
            header: "Ngày tạo",
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
            width: "w-44",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <div className="flex items-center justify-center gap-2">
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded-lg border border-slate-700 hover:border-cyan-500 text-xs text-slate-200"
                  >
                    Mở
                  </a>
                )}

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
        title="Xoá bản ghi?"
        description={`Bản ghi "${confirmDelete?.interview_title || confirmDelete?.filename || confirmDelete?.call_cid}" sẽ bị ẩn khỏi hệ thống.`}
        confirmText="Xoá"
        destructive
        loading={busyId === confirmDelete?.id}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
      />
    </AdminShell>
  );
}
