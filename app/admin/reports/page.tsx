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

// Chi tiết report trả về từ GET /api/admin/reports/[id] — có thêm
// content (JSONB tự do) + vài field snapshot khác.
type ReportDetail = ReportRow & {
  updated_at: string | null;
  cv_filename: string | null;
  coding_analysis_snapshot: unknown;
  content: unknown;
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

// ---------------------------------------------------------------------
// JsonPretty: render 1 giá trị JSON (object/array/primitive) bất kỳ
// thành các block dễ đọc, thay vì <pre>{JSON.stringify(...)}</pre>.
// Vì `content` là JSONB tự do (schema có thể đổi theo thời gian tuỳ
// prompt AI), component này không giả định cấu trúc cố định — chỉ format
// key thành label đẹp, và đệ quy xuống nested object/array.
// ---------------------------------------------------------------------
function prettifyKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function JsonPretty({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) {
    return <span className="text-slate-500 text-sm">—</span>;
  }

  if (typeof value === "string") {
    return (
      <span className="text-sm text-slate-200 whitespace-pre-wrap">
        {value || "—"}
      </span>
    );
  }

  if (typeof value === "number") {
    return <span className="text-sm text-cyan-300 font-medium">{value}</span>;
  }

  if (typeof value === "boolean") {
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          value
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-slate-600/30 text-slate-400"
        }`}
      >
        {value ? "Có" : "Không"}
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-500 text-sm">—</span>;
    }
    // Mảng chuỗi/số đơn giản → hiện dạng chip cho gọn.
    const isPrimitiveArray = value.every(
      (v) => typeof v === "string" || typeof v === "number",
    );
    if (isPrimitiveArray) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded-md bg-slate-700/40 text-slate-200 border border-slate-600/40"
            >
              {String(v)}
            </span>
          ))}
        </div>
      );
    }
    // Mảng object → mỗi phần tử 1 card con.
    return (
      <div className="space-y-2">
        {value.map((v, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-700/60 bg-slate-800/30 p-3"
          >
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              #{i + 1}
            </div>
            <JsonPretty value={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-slate-500 text-sm">—</span>;
    }
    return (
      <div className={depth === 0 ? "space-y-3" : "space-y-2 pl-3"}>
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="text-xs font-semibold text-slate-400 mb-1">
              {prettifyKey(k)}
            </div>
            <JsonPretty value={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-sm text-slate-300">{String(value)}</span>;
}

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
  const [preview, setPreview] = useState<ReportDetail | null>(null);
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
      setPreview(data.report as ReportDetail);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi");
      setPreviewId(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewId(null);
    setPreview(null);
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
                  {Number(r.ai_overall_score).toFixed(1)} / 10
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0B1120] border border-white/10 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <h2 className="text-lg font-semibold text-white">
                Nội dung report
              </h2>
              <button
                type="button"
                onClick={closePreview}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-5">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : preview ? (
                <div className="space-y-5">
                  {/* Tóm tắt */}
                  <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                        Phỏng vấn
                      </div>
                      <div className="text-sm text-white">
                        {preview.interview_title}
                      </div>
                      <div className="text-xs text-slate-400">
                        {preview.meeting_code}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                        AI Score
                      </div>
                      <div className="text-sm font-semibold text-cyan-300">
                        {preview.ai_overall_score != null
                          ? `${Number(preview.ai_overall_score).toFixed(1)} / 10`
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                        Model
                      </div>
                      <div className="text-sm text-slate-200">
                        {preview.ai_model || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                        Trạng thái
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[preview.status]}`}
                      >
                        {preview.status}
                      </span>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                        Người tạo
                      </div>
                      <div className="text-sm text-slate-200">
                        {preview.created_by_name || "—"}
                      </div>
                      {preview.created_by_email && (
                        <div className="text-xs text-slate-500">
                          {preview.created_by_email}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                        Tạo lúc
                      </div>
                      <div className="text-sm text-slate-200">
                        {new Date(preview.generated_at).toLocaleString("vi-VN")}
                      </div>
                    </div>
                    {preview.cv_filename && (
                      <div className="col-span-2 sm:col-span-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                          File CV
                        </div>
                        <div className="text-sm text-slate-200 break-all">
                          {preview.cv_filename}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Nội dung report (JSONB) */}
                  {preview.content != null && (
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-2">
                        Chi tiết đánh giá
                      </h3>
                      <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
                        <JsonPretty value={preview.content} />
                      </div>
                    </div>
                  )}

                  {/* Coding analysis snapshot (nếu có) */}
                  {preview.coding_analysis_snapshot != null && (
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-2">
                        Live Coding
                      </h3>
                      <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
                        <JsonPretty value={preview.coding_analysis_snapshot} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Không có dữ liệu.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
