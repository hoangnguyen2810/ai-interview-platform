"use client";

import { SideNavBar } from "@/app/components/SideNavBar";
import { TopNavBar } from "@/app/components/TopNavBar";
import { Search, Eye, Trash2, FileSpreadsheet, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import ReportViewer from "@/app/components/interview-room/coding/ReportViewer";
import { Pagination } from "@/app/components/Pagination";

// Dữ liệu từ /api/recruiter/reports: gồm candidate name, interview title,
// AI score, status (DRAFT/EDITED/FINAL), generated_at + meeting_code (để
// recruiter có thể mở lại report trong phòng phỏng vấn).
interface ReportDto {
  id: string;
  candidateName: string;
  interviewTitle: string;
  meetingCode: string;
  aiOverallScore: number | null;
  status: "DRAFT" | "EDITED" | "FINAL";
  generatedAt: string;
}

const STATUS_LABEL: Record<ReportDto["status"], string> = {
  DRAFT: "Nháp",
  EDITED: "Đã chỉnh sửa",
  FINAL: "Hoàn thành",
};

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Modal xem lại báo cáo dùng lại ReportViewer (cùng format với lúc tạo
  // / cập nhật trong phòng phỏng vấn). Lưu meetingCode của report đang mở.
  const [viewingMeetingCode, setViewingMeetingCode] = useState<string | null>(
    null,
  );

  const ITEMS_PER_PAGE = 10;

  function getAuthHeaders(): HeadersInit {
    const headers: Record<string, string> = {};
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("token");
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/recruiter/reports", {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
      const json = await res.json();
      setReports(Array.isArray(json.reports) ? json.reports : []);
    } catch (err) {
      console.error("[reports page] fetch error:", err);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [search, statusFilter]);

  function scoreColor(score: number | null) {
    if (score === null) return "text-slate-500";
    if (score >= 9) return "text-green-400";
    if (score >= 8) return "text-cyan-400";
    if (score >= 7) return "text-yellow-400";
    return "text-red-400";
  }

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        r.candidateName.toLowerCase().includes(q) ||
        r.interviewTitle.toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [reports, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSelectAll() {
    if (
      paginatedReports.length > 0 &&
      paginatedReports.every((r) => selectedIds.includes(r.id))
    ) {
      setSelectedIds((prev) =>
        prev.filter((id) => !paginatedReports.some((r) => r.id === id)),
      );
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      paginatedReports.forEach((r) => next.add(r.id));
      return Array.from(next);
    });
  }

  function handleView(report: ReportDto) {
    setViewingMeetingCode(report.meetingCode);
  }

  async function handleDelete() {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/recruiter/reports", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setSelectedIds([]);
      setConfirmDelete(false);
      await fetchReports();
    } catch (err) {
      console.error("[reports page] delete error:", err);
    } finally {
      setDeleting(false);
    }
  }

  function handleExportExcel() {
    // Chọn danh sách xuất: nếu user đã tick chọn → xuất các dòng đã chọn,
    // nếu không → xuất tất cả các dòng trong bảng đang lọc.
    const exportSet =
      selectedIds.length > 0
        ? new Set(selectedIds)
        : new Set(filtered.map((r) => r.id));
    const rows = filtered.filter((r) => exportSet.has(r.id));

    if (rows.length === 0) return;

    const headers = [
      "Tên ứng viên",
      "Tên buổi phỏng vấn",
      "Điểm AI",
      "Trạng thái",
      "Ngày tạo",
    ];

    const esc = (val: string) => {
      // Escape theo CSV: bọc giá trị có dấu phẩy/nháy đôi/newline trong cặp
      // nháy đôi, đồng thời escape nháy đôi thành "".
      const needQuote = /[",\n]/.test(val);
      const escaped = val.replace(/"/g, '""');
      return needQuote ? `"${escaped}"` : escaped;
    };

    const lines = [
      headers.map(esc).join(","),
      ...rows.map((r) =>
        [
          r.candidateName,
          r.interviewTitle,
          r.aiOverallScore != null ? r.aiOverallScore.toString() : "",
          STATUS_LABEL[r.status] ?? r.status,
          new Date(r.generatedAt).toLocaleDateString("vi-VN"),
        ]
          .map((v) => esc(v ?? ""))
          .join(","),
      ),
    ];

    // BOM để Excel nhận diện UTF-8 đúng tiếng Việt có dấu.
    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `reports-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <TopNavBar />
      <SideNavBar />

      <main className="ml-sidebar-width pt-20 px-10 pb-10 min-h-screen bg-[#071524] text-white">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Quản lí báo cáo</h1>
            <p className="text-slate-400 mt-2">
              Quản lý báo cáo AI sau phỏng vấn
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleExportExcel}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-400 transition"
            >
              <FileSpreadsheet size={18} />
              Xuất Excel
            </button>

            <button
              disabled={!selectedIds.length || deleting}
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-600 disabled:bg-slate-700 disabled:text-slate-400 hover:bg-red-500 transition"
            >
              <Trash2 size={18} />
              Xoá
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-6 mb-8">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                placeholder="Tìm ứng viên, buổi phỏng vấn..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#071524] border border-slate-700 rounded-xl pl-11 pr-4 py-3 outline-none focus:border-cyan-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#071524] border border-slate-700 rounded-xl px-4"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="EDITED">Đã chỉnh sửa</option>
              <option value="FINAL">Hoàn thành</option>
            </select>
          </div>

          {selectedIds.length > 0 && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-5 py-4">
              <span className="font-medium text-cyan-300">
                {selectedIds.length} report(s) selected
                {selectedIds.length === 1
                  ? ""
                  : ` · ${selectedIds.length} selected trong danh sách hiện tại`}
              </span>
              <button
                onClick={() => setSelectedIds([])}
                className="text-sm text-cyan-400 hover:text-cyan-300"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 flex justify-center items-center gap-3">
              <Loader2 className="animate-spin" />
              Loading reports...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              Không tìm thấy report nào.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[#13263a]">
                <tr>
                  <th className="p-5 w-12">
                    <input
                      type="checkbox"
                      checked={
                        paginatedReports.length > 0 &&
                        paginatedReports.every((r) =>
                          selectedIds.includes(r.id),
                        )
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="p-5 text-left">Tên ứng viên</th>
                  <th className="p-5 text-left">Tên buổi phỏng vấn</th>
                  <th className="p-5 text-center">Điểm AI</th>
                  <th className="p-5 text-center">Trạng thái</th>
                  <th className="p-5 text-center">Ngày tạo</th>
                  <th className="p-5 text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedReports.map((report) => (
                  <tr
                    key={report.id}
                    className="border-t border-slate-800 hover:bg-cyan-500/5"
                  >
                    <td className="p-5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(report.id)}
                        onChange={() => toggleSelect(report.id)}
                      />
                    </td>

                    <td className="p-5">{report.candidateName || "—"}</td>

                    <td className="p-5">{report.interviewTitle || "—"}</td>

                    <td
                      className={`p-5 text-center font-bold ${scoreColor(
                        report.aiOverallScore,
                      )}`}
                    >
                      {report.aiOverallScore != null
                        ? report.aiOverallScore.toFixed(1)
                        : "-"}
                    </td>

                    <td className="p-5 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          report.status === "FINAL"
                            ? "bg-purple-500/20 text-purple-300"
                            : report.status === "EDITED"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-yellow-500/20 text-yellow-300"
                        }`}
                      >
                        {STATUS_LABEL[report.status]}
                      </span>
                    </td>

                    <td className="p-5 text-center">
                      {new Date(report.generatedAt).toLocaleDateString("vi-VN")}
                    </td>

                    <td className="p-5">
                      <div className="flex justify-center gap-2">
                        <button
                          title="Xem lại báo cáo"
                          onClick={() => handleView(report)}
                          className="p-2 hover:bg-slate-700 rounded-lg"
                        >
                          <Eye size={18} />
                        </button>

                        <button
                          title="Xoá"
                          onClick={() => {
                            setSelectedIds([report.id]);
                            setConfirmDelete(true);
                          }}
                          className="p-2 hover:bg-slate-700 rounded-lg text-red-400"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between mt-6 px-4">
            <div className="text-sm text-slate-400">
              Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} -
              {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}
              {" / "}
              {filtered.length} reports
            </div>

            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-lg bg-slate-700 disabled:opacity-40 hover:bg-slate-600"
              >
                ←
              </button>

              {Array.from({ length: totalPages }).map((_, index) => {
                const page = index + 1;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-lg ${
                      page === currentPage
                        ? "bg-cyan-500"
                        : "bg-slate-700 hover:bg-slate-600"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="px-4 py-2 rounded-lg bg-slate-700 disabled:opacity-40 hover:bg-slate-600"
              >
                →
              </button>
            </div>
          </div>
        )}

        {/* Confirm delete dialog */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-[#0F1E2E] border border-cyan-500/20 rounded-2xl p-6 w-[420px]">
              <h3 className="text-lg font-bold text-white mb-2">
                Xoá {selectedIds.length} report(s)?
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                Hành động này sẽ ẩn report khỏi danh sách. Có thể khôi phục từ
                database nếu cần.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 text-sm font-semibold flex items-center gap-2"
                >
                  {deleting && <Loader2 size={14} className="animate-spin" />}
                  Xoá
                </button>
              </div>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </main>

      {/* Modal xem lại báo cáo — dùng lại ReportViewer để có cùng format
          với lúc tạo / cập nhật trong phòng phỏng vấn. */}
      {viewingMeetingCode && (
        <ReportViewer
          meetingCode={viewingMeetingCode}
          onClose={() => {
            setViewingMeetingCode(null);
            fetchReports();
          }}
        />
      )}
    </>
  );
}
