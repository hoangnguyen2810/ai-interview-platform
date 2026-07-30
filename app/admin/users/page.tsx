"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Power, PowerOff, Trash2 } from "lucide-react";
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

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: "ADMIN" | "RECRUITER" | "CANDIDATE";
  provider: "LOCAL" | "GOOGLE";
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
};

const ROLE_OPTIONS = [
  { value: "", label: "Tất cả vai trò" },
  { value: "ADMIN", label: "ADMIN" },
  { value: "RECRUITER", label: "RECRUITER" },
  { value: "CANDIDATE", label: "CANDIDATE" },
];
const ACTIVE_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "true", label: "Đang hoạt động" },
  { value: "false", label: "Đã khoá" },
];

export default function AdminUsersPage() {
  const { ready } = useAdminGuard();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [isActive, setIsActive] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
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
      if (role) params.set("role", role);
      if (isActive) params.set("is_active", isActive);

      const data = await fetchJson<Paginated<UserRow>>(
        `/api/admin/users?${params.toString()}`,
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
  }, [ready, page, limit, search, role, isActive]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleActive = async (u: UserRow) => {
    setBusyId(u.id);
    try {
      const res = await adminFetch("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ id: u.id, is_active: !u.is_active }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Lỗi");
      setRows((prev) =>
        prev.map((r) =>
          r.id === u.id ? { ...r, is_active: !u.is_active } : r,
        ),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (u: UserRow) => {
    setBusyId(u.id);
    try {
      const res = await adminFetch(
        `/api/admin/users?id=${encodeURIComponent(u.id)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Lỗi");
      setRows((prev) => prev.filter((r) => r.id !== u.id));
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Quản lý người dùng</h1>
          <p className="mt-1 text-sm text-slate-400">
            Xem, khoá/mở khoá, hoặc xoá mềm tài khoản.
          </p>
        </div>
      </div>

      <AdminFilter
        search={search}
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        selects={[
          {
            value: role,
            onChange: (v) => {
              setPage(1);
              setRole(v);
            },
            options: ROLE_OPTIONS,
          },
          {
            value: isActive,
            onChange: (v) => {
              setPage(1);
              setIsActive(v);
            },
            options: ACTIVE_OPTIONS,
          },
        ]}
      />

      {error && (
        <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <AdminTable<UserRow>
        rows={rows}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage="Không tìm thấy user nào."
        columns={[
          {
            key: "info",
            header: "Người dùng",
            width: "w-[360px]",
            render: (r) => (
              <div className="flex items-center gap-3">
                {r.avatar_url ? (
                  <img
                    src={r.avatar_url}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-cyan-500/15 text-cyan-300 flex items-center justify-center text-sm font-bold">
                    {(r.full_name || r.email)?.[0]?.toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {r.full_name}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {r.email}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "role",
            header: "Vai trò",
            width: "w-36",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {r.role}
              </span>
            ),
          },
          {
            key: "provider",
            header: "Loại tài khoản",
            width: "w-32",
            headerClassName: "text-center",
            cellClassName: "text-center text-xs text-slate-300",
            render: (r) => r.provider,
          },
          {
            key: "active",
            header: "Trạng thái",
            width: "w-36",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) =>
              r.is_active ? (
                <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Hoạt động
                </span>
              ) : (
                <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  Đã khóa
                </span>
              ),
          },
          {
            key: "actions",
            header: "Hành động",
            width: "w-56",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => toggleActive(r)}
                  className="px-2 py-1 rounded-lg border border-slate-700 hover:border-cyan-500 text-xs text-slate-200 flex items-center gap-1 disabled:opacity-50"
                >
                  {r.is_active ? (
                    <>
                      <PowerOff className="w-3 h-3" />
                      Khoá
                    </>
                  ) : (
                    <>
                      <Power className="w-3 h-3" />
                      Mở
                    </>
                  )}
                </button>

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
        title="Xoá người dùng?"
        description={`Tài khoản "${confirmDelete?.email}" sẽ bị xoá mềm (có thể khôi phục từ DB).`}
        confirmText="Xoá"
        destructive
        loading={busyId === confirmDelete?.id}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
      />
    </AdminShell>
  );
}
