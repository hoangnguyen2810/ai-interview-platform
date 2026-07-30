"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { AdminShell } from "@/app/components/admin-dashboard/AdminShell";
import { AdminTable } from "@/app/components/admin-dashboard/AdminTable";
import { AdminFilter } from "@/app/components/admin-dashboard/AdminFilter";
import { AdminPagination } from "@/app/components/admin-dashboard/AdminPagination";
import { ConfirmDialog } from "@/app/components/admin-dashboard/ConfirmDialog";
import {
  AdminFormModal,
  type AdminFormField,
} from "@/app/components/admin-dashboard/AdminFormModal";
import { useAdminGuard } from "@/app/components/admin-dashboard/useAdminGuard";
import {
  adminFetch,
  fetchJson,
  type Paginated,
} from "@/app/components/admin-dashboard/api";

type QuestionRow = {
  id: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  created_at: string;
  created_by_name: string | null;
  test_case_count: number;
};

const DIFFICULTY_OPTIONS = [
  { value: "", label: "Tất cả độ khó" },
  { value: "EASY", label: "EASY" },
  { value: "MEDIUM", label: "MEDIUM" },
  { value: "HARD", label: "HARD" },
];

const DIFFICULTY_COLOR: Record<QuestionRow["difficulty"], string> = {
  EASY: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  HARD: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
};

const FORM_FIELDS: AdminFormField[] = [
  { name: "title", label: "Tiêu đề", type: "text", required: true },
  {
    name: "description",
    label: "Mô tả",
    type: "textarea",
    required: true,
    placeholder: "Mô tả chi tiết đề bài…",
  },
  {
    name: "difficulty",
    label: "Độ khó",
    type: "select",
    required: true,
    placeholder: "-- chọn --",
    options: [
      { value: "EASY", label: "EASY" },
      { value: "MEDIUM", label: "MEDIUM" },
      { value: "HARD", label: "HARD" },
    ],
  },
];

export default function AdminQuestionsPage() {
  const { ready } = useAdminGuard();
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionRow | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QuestionRow | null>(null);
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
      if (difficulty) params.set("difficulty", difficulty);
      const data = await fetchJson<Paginated<QuestionRow>>(
        `/api/admin/questions?${params.toString()}`,
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
  }, [ready, page, limit, search, difficulty]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };
  const openEdit = (q: QuestionRow) => {
    setEditing(q);
    setFormError(null);
    setFormOpen(true);
  };

  const submitForm = async (values: Record<string, string>) => {
    setFormLoading(true);
    setFormError(null);
    try {
      let res: Response;
      if (editing) {
        res = await adminFetch("/api/admin/questions", {
          method: "PATCH",
          body: JSON.stringify({ id: editing.id, ...values }),
        });
      } else {
        res = await adminFetch("/api/admin/questions", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Lỗi");
      setFormOpen(false);
      fetchData();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setFormLoading(false);
    }
  };

  const doDelete = async (q: QuestionRow) => {
    setBusyId(q.id);
    try {
      const res = await adminFetch(
        `/api/admin/questions?id=${encodeURIComponent(q.id)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Lỗi");
      setRows((prev) => prev.filter((r) => r.id !== q.id));
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
        <h1 className="text-2xl font-bold text-white">Kho câu hỏi lập trình</h1>
        <p className="mt-1 text-sm text-slate-400">
          Các bài tập lập trình được tạo ra trong quá trình phỏng vấn
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
            value: difficulty,
            onChange: (v) => {
              setPage(1);
              setDifficulty(v);
            },
            options: DIFFICULTY_OPTIONS,
          },
        ]}
        rightSlot={
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Tạo câu hỏi
          </button>
        }
      />

      {error && (
        <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <AdminTable<QuestionRow>
        rows={rows}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage="Chưa có câu hỏi nào."
        columns={[
          {
            key: "title",
            header: "Câu hỏi",
            width: "w-[420px]",
            render: (r) => (
              <div className="min-w-0">
                <div
                  className="text-sm font-medium text-white truncate"
                  title={r.title}
                >
                  {r.title}
                </div>

                <div
                  className="text-xs text-slate-400 line-clamp-2"
                  title={r.description}
                >
                  {r.description}
                </div>
              </div>
            ),
          },
          {
            key: "difficulty",
            header: "Độ khó",
            width: "w-32",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <span
                className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${DIFFICULTY_COLOR[r.difficulty]}`}
              >
                {r.difficulty}
              </span>
            ),
          },
          {
            key: "tests",
            header: "Test case",
            width: "w-28",
            headerClassName: "text-center",
            cellClassName: "text-center",
            render: (r) => (
              <span className="text-sm text-slate-300">
                {r.test_case_count}
              </span>
            ),
          },
          {
            key: "creator",
            header: "Người tạo",
            width: "w-48",
            render: (r) => (
              <span
                className="text-sm text-slate-300 truncate block"
                title={r.created_by_name || ""}
              >
                {r.created_by_name || "—"}
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
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="px-2 py-1 rounded-lg border border-slate-700 hover:border-cyan-500 text-xs text-slate-200 flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" />
                  Sửa
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

      <AdminFormModal
        open={formOpen}
        title={editing ? "Sửa câu hỏi" : "Tạo câu hỏi"}
        fields={FORM_FIELDS}
        initialValues={
          editing
            ? {
                title: editing.title,
                description: editing.description,
                difficulty: editing.difficulty,
              }
            : undefined
        }
        loading={formLoading}
        error={formError}
        onSubmit={submitForm}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Xoá câu hỏi?"
        description={`Câu hỏi "${confirmDelete?.title}" sẽ bị xoá (cascade test_cases và interview_questions liên quan).`}
        confirmText="Xoá"
        destructive
        loading={busyId === confirmDelete?.id}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
      />
    </AdminShell>
  );
}
