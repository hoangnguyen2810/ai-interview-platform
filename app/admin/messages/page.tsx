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

type MessageRow = {
  id: string;
  session_id: string | null;
  sender_id: string | null;
  guest_name: string | null;
  sender_name: string | null;
  content: string;
  type: string | null;
  meeting_code: string | null;
  created_at: string;
  sender_email: string | null;
};

const TYPE_COLOR: Record<string, string> = {
  TEXT: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
  SYSTEM: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30",
  FILE: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
};

function typeColor(type: string | null) {
  if (!type) return TYPE_COLOR.TEXT;
  return TYPE_COLOR[type.toUpperCase()] || TYPE_COLOR.TEXT;
}

function truncate(text: string, len = 100) {
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

export default function AdminMessagesPage() {
  const { ready } = useAdminGuard();
  const [search, setSearch] = useState("");
  const [meetingCode, setMeetingCode] = useState("");

  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MessageRow | null>(null);
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
      if (meetingCode) params.set("meeting_code", meetingCode);

      if (type) params.set("type", type);
      const data = await fetchJson<Paginated<MessageRow>>(
        `/api/admin/messages?${params.toString()}`,
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
  }, [ready, page, limit, search, meetingCode, type]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const doDelete = async (row: MessageRow) => {
    setBusyId(row.id);
    try {
      const res = await adminFetch(
        `/api/admin/messages?id=${encodeURIComponent(row.id)}`,
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
        <h1 className="text-2xl font-bold text-white">Quản lý tin nhắn</h1>
        <p className="mt-1 text-sm text-slate-400">
          Danh sách tin nhắn chat trong các phiên phỏng vấn.
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
          <label className="text-xs text-slate-400 mb-1">Meeting code</label>
          <input
            type="text"
            value={meetingCode}
            onChange={(e) => {
              setPage(1);
              setMeetingCode(e.target.value);
            }}
            placeholder="vd: ABC-123"
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 w-36"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-slate-400 mb-1">Loại</label>
          <input
            type="text"
            value={type}
            onChange={(e) => {
              setPage(1);
              setType(e.target.value);
            }}
            placeholder="TEXT / SYSTEM / ..."
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 w-40"
          />
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <AdminTable<MessageRow>
        rows={rows}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage="Không có tin nhắn nào."
        columns={[
          {
            key: "sender",
            header: "Người gửi",
            width: "w-64",
            render: (r) => (
              <div>
                <div className="font-medium text-slate-100">
                  {r.sender_name || r.guest_name || "Khách"}
                </div>
                <div className="text-xs text-slate-400">
                  {r.sender_email || "—"}
                </div>
              </div>
            ),
          },

          {
            key: "content",
            header: "Nội dung",
            width: "w-[300 px]",
            render: (r) => (
              <span
                className="block max-w-[380px] truncate text-sm text-slate-200"
                title={r.content}
              >
                {r.content}
              </span>
            ),
          },

          {
            key: "type",
            header: "Loại",
            width: "w-28",
            render: (r) => (
              <span
                className={`px-2 py-1 rounded-full text-xs font-semibold ${typeColor(
                  r.type,
                )}`}
              >
                {r.type ?? "TEXT"}
              </span>
            ),
          },

          {
            key: "meeting",
            header: "Mã phòng ",
            width: "w-40",
            render: (r) => (
              <span className="font-mono text-xs text-cyan-300">
                {r.meeting_code || "—"}
              </span>
            ),
          },

          {
            key: "created",
            header: "Thời gian gửi",
            width: "w-48",
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
            render: (r) => (
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => setConfirmDelete(r)}
                className="px-2 py-1 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs flex items-center gap-1 disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                Xóa
              </button>
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
        title="Xoá tin nhắn?"
        description={`Tin nhắn "${confirmDelete ? truncate(confirmDelete.content, 60) : ""}" sẽ bị xoá vĩnh viễn.`}
        confirmText="Xoá"
        destructive
        loading={busyId === confirmDelete?.id}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
      />
    </AdminShell>
  );
}
