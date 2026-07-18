"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

// 8 sections matching CHAT_PROMPT rule 8 / ai-report.ts.
interface ReportContent {
  candidate_name: string;
  position: string;
  summary: string;
  strengths: string;
  weaknesses: string;
  skill_evaluation: string;
  improvement_suggestions: string;
  hiring_conclusion: string;
}

// Safe stringifier: converts any value to a trimmed string, or "" if null/undefined.
// Guards against array/object/number fields from AI that would otherwise throw
// e.g. "report.content?.x?.trim is not a function".
function safeStr(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val.trim();
  return String(val).trim();
}

// Strip HTML tags so we can safely render AI output inside whitespace-pre-wrap
// containers without triggering "cannot nest <pre> in <p>" hydration errors.
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

interface ReportPayload {
  id: string;
  content: ReportContent;
  cv_filename: string | null;
  cv_analysis: string | null;
  coding_analysis_snapshot: string | null;
  ai_overall_score: number | null;
  ai_model: string | null;
  status: string;
  generated_at: string;
  updated_at: string;
}

interface ReportViewerProps {
  meetingCode: string;
  onClose: () => void;
  onReportChanged?: (report: ReportPayload) => void;
}

const SECTIONS: Array<{
  key: keyof ReportContent;
  label: string;
  placeholder: string;
}> = [
  {
    key: "candidate_name",
    label: "Tên ứng viên",
    placeholder: "Ví dụ: Nguyễn Văn A",
  },
  {
    key: "position",
    label: "Vị trí ứng tuyển",
    placeholder: "Ví dụ: Backend Engineer",
  },
  {
    key: "summary",
    label: "Tóm tắt",
    placeholder: "Tóm tắt ngắn gọn về ứng viên (2-4 câu)",
  },
  {
    key: "strengths",
    label: "Điểm mạnh",
    placeholder: "3-5 gạch đầu dòng",
  },
  {
    key: "weaknesses",
    label: "Điểm yếu",
    placeholder: "3-5 gạch đầu dòng",
  },
  {
    key: "skill_evaluation",
    label: "Đánh giá kỹ năng",
    placeholder: "Đánh giá kỹ năng kỹ thuật dựa trên coding analysis",
  },
  {
    key: "improvement_suggestions",
    label: "Đề xuất cải thiện",
    placeholder: "3-5 gạch đầu dòng",
  },
  {
    key: "hiring_conclusion",
    label: "Kết luận tuyển dụng",
    placeholder: "MẠNH / PHÙ HỢP / CÂN NHẮC / KHÔNG PHÙ HỢP + giải thích",
  },
];

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", { hour12: false });
  } catch {
    return iso;
  }
}

function formatShortDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      hour12: false,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "FINAL":
      return "bg-green-500/15 text-green-400 border-green-500/30";
    case "EDITED":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "DRAFT":
    default:
      return "bg-[#3b82f6]/15 text-[#60a5fa] border-cyan-500/30";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "FINAL":
      return "Hoàn tất";
    case "EDITED":
      return "Đã chỉnh sửa";
    case "DRAFT":
    default:
      return "Bản nháp";
  }
}

export default function ReportViewer({
  meetingCode,
  onClose,
  onReportChanged,
}: ReportViewerProps) {
  const [reports, setReports] = useState<ReportPayload[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ReportContent | null>(null);
  const [draftScore, setDraftScore] = useState<string>("");

  const report = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? null,
    [reports, selectedId],
  );

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/report`,
        {
          method: "GET",
          headers: getAuthHeaders(),
          credentials: "include",
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Không tải được báo cáo");
      }
      const list: ReportPayload[] = data.reports ?? [];
      setReports(list);
      // Default-select the first report so the main panel has content to show.
      // If the previously selected report still exists, keep it.
      setSelectedId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
      onReportChanged?.(list[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải báo cáo");
    } finally {
      setLoading(false);
    }
  }, [meetingCode, onReportChanged]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Auto-clear transient messages
  useEffect(() => {
    if (!error && !success) return;
    const t = setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [error, success]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      setSuccess(null);
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/report`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify({}),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Không tạo được báo cáo");
      }
      // Insert the new report at the top and select it.
      const newReport: ReportPayload = data.report;
      setReports((prev) => [newReport, ...prev]);
      setSelectedId(newReport.id);
      setEditing(false);
      setSuccess("Đã tạo báo cáo AI");
      onReportChanged?.(newReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tạo báo cáo");
    } finally {
      setGenerating(false);
    }
  };

  const handleSelect = (id: string) => {
    if (editing) {
      // Don't allow switching mid-edit to avoid losing draft.
      return;
    }
    setSelectedId(id);
  };

  const handleDelete = async () => {
    if (!report) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Xoá báo cáo này? Hành động không thể hoàn tác.",
      );
      if (!ok) return;
    }
    try {
      setDeleting(true);
      setError(null);
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(
          meetingCode,
        )}/report?reportId=${encodeURIComponent(report.id)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
          credentials: "include",
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Không xoá được báo cáo");
      }
      const remaining = reports.filter((r) => r.id !== report.id);
      setReports(remaining);
      const nextSelected = remaining[0]?.id ?? null;
      setSelectedId(nextSelected);
      setSuccess("Đã xoá báo cáo");
      onReportChanged?.(remaining[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi xoá báo cáo");
    } finally {
      setDeleting(false);
    }
  };

  const handleStartEdit = () => {
    if (!report) return;
    setDraft({ ...report.content });
    setDraftScore(
      report.ai_overall_score !== null && report.ai_overall_score !== undefined
        ? String(report.ai_overall_score)
        : "",
    );
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setDraft(null);
    setDraftScore("");
  };

  const handleSave = async () => {
    if (!draft || !report) return;
    try {
      setSaving(true);
      setError(null);
      const scoreNum =
        draftScore.trim() === "" ? null : Number.parseFloat(draftScore);
      if (
        draftScore.trim() !== "" &&
        (Number.isNaN(scoreNum) || scoreNum! < 0 || scoreNum! > 10)
      ) {
        throw new Error("Điểm tổng phải nằm trong [0, 10]");
      }

      const res = await fetch(
        `/api/interviews/${encodeURIComponent(
          meetingCode,
        )}/report?reportId=${encodeURIComponent(report.id)}`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify({
            content: draft,
            ai_overall_score: scoreNum,
            status: "EDITED",
          }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Không lưu được báo cáo");
      }
      const updated: ReportPayload = data.report;
      setReports((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      setEditing(false);
      setDraft(null);
      setSuccess("Đã lưu báo cáo");
      onReportChanged?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi lưu báo cáo");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkFinal = async () => {
    if (!report) return;
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(
          meetingCode,
        )}/report?reportId=${encodeURIComponent(report.id)}`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify({ status: "FINAL" }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Không cập nhật được trạng thái");
      }
      const updated: ReportPayload = data.report;
      setReports((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      setSuccess("Đã đánh dấu báo cáo là Hoàn tất");
      onReportChanged?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi cập nhật trạng thái");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1b1b1b] border border-cyan-500/30 rounded-xl w-full max-w-5xl max-h-[90vh] flex shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar — list of reports */}
        <div className="w-64 shrink-0 border-r border-[#313131] bg-[#202020] rounded-l-xl flex flex-col">
          <div className="px-3 py-3 border-b border-[#313131] flex items-center justify-between">
            <div className="min-w-0">
              <h4 className="text-white font-semibold text-xs uppercase tracking-wide">
                Báo cáo ({reports.length})
              </h4>
              <p className="text-white/40 text-[10px] mt-0.5">
                Mỗi lần tạo sẽ thêm bản mới
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              title="Tạo báo cáo AI mới"
              className="flex items-center justify-center h-7 w-7 rounded-md bg-[#3b82f6] hover:bg-[#2563eb] text-white transition shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-base">add</span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="text-white/40 text-xs px-3 py-4">Đang tải...</div>
            ) : reports.length === 0 ? (
              <div className="text-white/40 text-xs px-3 py-4 leading-relaxed">
                Chưa có báo cáo. Bấm nút "+" để tạo báo cáo AI đầu tiên.
              </div>
            ) : (
              <ul className="py-1">
                {reports.map((r) => {
                  const isSelected = r.id === selectedId;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(r.id)}
                        disabled={editing}
                        className={`w-full text-left px-3 py-2.5 border-l-2 transition-colors ${
                          isSelected
                            ? "bg-[#2d2d30] border-cyan-400"
                            : "border-transparent hover:bg-white/5"
                        } ${editing && !isSelected ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-white text-xs font-medium truncate">
                            {safeStr(r.content?.candidate_name) ||
                              "Chưa đặt tên"}
                          </span>
                          <span
                            className={`shrink-0 px-1.5 py-0.5 rounded border text-[9px] font-semibold ${statusBadgeClass(r.status)}`}
                          >
                            {statusLabel(r.status)}
                          </span>
                        </div>
                        <div className="text-white/70 text-[10px] truncate">
                          {safeStr(r.content?.candidate_name) || "Chưa đặt tên"}
                          {safeStr(r.content?.position)
                            ? ` • ${safeStr(r.content?.position)}`
                            : ""}
                        </div>
                        <div className="text-white/40 text-[10px] truncate mt-0.5">
                          {formatShortDateTime(r.generated_at)}
                          {r.ai_overall_score !== null && (
                            <>
                              {" • "}
                              <span className="text-[#60a5fa]">
                                {r.ai_overall_score.toFixed(1)}/10
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 flex flex-col min-w-0 rounded-r-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#313131] bg-[#252526] rounded-tr-xl">
            <div className="flex items-center gap-3 min-w-0">
              <span className="material-symbols-outlined text-[#3b82f6]">
                description
              </span>
              <div className="min-w-0">
                <h3 className="text-white font-semibold text-sm">
                  Báo cáo phỏng vấn (AI tổng hợp)
                </h3>
                <p className="text-white/40 text-[11px] truncate">
                  {report ? (
                    <>
                      Tạo: {formatDateTime(report.generated_at)} • Cập nhật:{" "}
                      {formatDateTime(report.updated_at)}
                      {report.ai_model && ` • Model: ${report.ai_model}`}
                    </>
                  ) : (
                    "Chưa có báo cáo"
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white/50 hover:text-white transition-colors p-1"
              aria-label="Đóng"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Status banner */}
          {(error || success) && (
            <div
              className={`px-4 py-2 text-sm border-b border-[#313131] ${
                error
                  ? "bg-red-500/10 text-red-300"
                  : "bg-green-500/10 text-green-300"
              }`}
            >
              {error || success}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 text-sm custom-scrollbar">
            {loading ? (
              <div className="h-full flex items-center justify-center text-white/50 py-16">
                Đang tải...
              </div>
            ) : !report ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-white/50 py-16">
                <span className="material-symbols-outlined text-5xl text-white/30">
                  auto_awesome
                </span>
                <p>Chưa có báo cáo cho buổi phỏng vấn này.</p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-5 py-2.5 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold transition shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Đang tạo báo cáo AI...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">
                        auto_awesome
                      </span>
                      Tạo báo cáo AI
                    </>
                  )}
                </button>
                <p className="text-xs text-white/30 max-w-md text-center">
                  AI sẽ tổng hợp thông tin từ CV (nếu có) và các bài coding đã
                  submit, tạo báo cáo 8 phần. Sau đó bạn có thể chỉnh sửa trước
                  khi lưu.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status row + actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[#0d1c2d] border border-[#313131]">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-white/50">Trạng thái:</span>
                    <span
                      className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${statusBadgeClass(report.status)}`}
                    >
                      {statusLabel(report.status)}
                    </span>
                    {report.ai_overall_score !== null && (
                      <span className="text-white/60">
                        • Điểm AI đề xuất:{" "}
                        <span className="text-[#60a5fa] font-semibold">
                          {report.ai_overall_score.toFixed(2)}
                        </span>{" "}
                        / 10
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!editing && (
                      <>
                        <button
                          type="button"
                          onClick={handleStartEdit}
                          className="px-3 py-1.5 rounded-md bg-[#2d2d30] hover:bg-[#3b82f6]/20 text-[#60a5fa] border border-cyan-500/30 text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-xs">
                            edit
                          </span>
                          Chỉnh sửa
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerate}
                          disabled={generating}
                          className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {generating ? "Đang tạo..." : "Tạo bản mới"}
                        </button>
                        {report.status !== "FINAL" && (
                          <button
                            type="button"
                            onClick={handleMarkFinal}
                            disabled={saving}
                            className="px-3 py-1.5 rounded-md bg-green-500/15 hover:bg-green-500/25 text-green-300 border border-green-500/30 text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-xs">
                              check_circle
                            </span>
                            Đánh dấu hoàn tất
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={deleting}
                          title="Xoá báo cáo này"
                          className="px-3 py-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-xs">
                            delete
                          </span>
                          {deleting ? "Đang xoá..." : "Xoá"}
                        </button>
                      </>
                    )}
                    {editing && (
                      <>
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          className="px-3 py-1.5 rounded-md bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {saving ? "Đang lưu..." : "Lưu"}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          Hủy
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* ── View mode: unified report format ────────────────────── */}
                {!editing && (
                  <div className="space-y-0 rounded-lg border border-[#313131] bg-[#0d1c2d] overflow-hidden">
                    {/* THÔNG TIN ỨNG VIÊN */}
                    <div className="p-4 border-b border-[#313131]">
                      <div className="text-[#3b82f6] font-semibold text-xs mb-1 uppercase tracking-wide">
                        THÔNG TIN ỨNG VIÊN
                      </div>
                      <div className="text-cyan-500/40 text-xs mb-2">
                        ────────────────────────
                      </div>
                      <div className="space-y-0.5 text-sm text-white/85">
                        <div>
                          <span className="text-white/50">Tên ứng viên: </span>
                          <span className="text-white">
                            {safeStr(report.content?.candidate_name) || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/50">
                            Vị trí ứng tuyển:{" "}
                          </span>
                          <span className="text-white">
                            {safeStr(report.content?.position) || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/50">Điểm tổng: </span>
                          <span className="text-[#60a5fa] font-semibold">
                            {report.ai_overall_score != null
                              ? `${report.ai_overall_score.toFixed(1)} / 10`
                              : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="text-cyan-500/40 text-xs mt-2">
                        ────────────────────────
                      </div>
                    </div>

                    {/* TÓM TẮT */}
                    {safeStr(report.content?.summary) && (
                      <div className="p-4 border-b border-[#313131]">
                        <div className="text-[#3b82f6] font-semibold text-xs mb-1 uppercase tracking-wide">
                          TÓM TẮT
                        </div>
                        <div className="text-cyan-500/40 text-xs mb-2">
                          ────────────────────────
                        </div>
                        <div className="text-white/85 text-sm whitespace-pre-wrap leading-relaxed">
                          {stripHtml(safeStr(report.content?.summary))}
                        </div>
                      </div>
                    )}

                    {/* ĐÁNH GIÁ KỸ NĂNG */}
                    {safeStr(report.content?.skill_evaluation) && (
                      <div className="p-4 border-b border-[#313131]">
                        <div className="text-[#3b82f6] font-semibold text-xs mb-1 uppercase tracking-wide">
                          ĐÁNH GIÁ KỸ NĂNG
                        </div>
                        <div className="text-cyan-500/40 text-xs mb-2">
                          ────────────────────────
                        </div>
                        <div className="text-white/85 text-sm whitespace-pre-wrap leading-relaxed">
                          {stripHtml(safeStr(report.content?.skill_evaluation))}
                        </div>
                      </div>
                    )}

                    {/* ĐIỂM MẠNH */}
                    {safeStr(report.content?.strengths) && (
                      <div className="p-4 border-b border-[#313131]">
                        <div className="text-[#3b82f6] font-semibold text-xs mb-1 uppercase tracking-wide">
                          ĐIỂM MẠNH
                        </div>
                        <div className="text-cyan-500/40 text-xs mb-2">
                          ────────────────────────
                        </div>
                        <div className="text-white/85 text-sm whitespace-pre-wrap leading-relaxed">
                          {stripHtml(safeStr(report.content?.strengths))}
                        </div>
                      </div>
                    )}

                    {/* ĐIỂM CẦN CẢI THIỆN */}
                    {safeStr(report.content?.weaknesses) ||
                    safeStr(report.content?.improvement_suggestions) ? (
                      <div className="p-4 border-b border-[#313131]">
                        <div className="text-[#3b82f6] font-semibold text-xs mb-1 uppercase tracking-wide">
                          ĐIỂM CẦN CẢI THIỆN
                        </div>
                        <div className="text-cyan-500/40 text-xs mb-2">
                          ────────────────────────
                        </div>
                        <div className="text-white/85 text-sm whitespace-pre-wrap leading-relaxed">
                          {[
                            safeStr(report.content?.weaknesses),
                            safeStr(report.content?.improvement_suggestions),
                          ]
                            .filter(Boolean)
                            .map((text, i) => (
                              <div key={i} className={i > 0 ? "mt-2" : ""}>
                                {stripHtml(text)}
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : null}

                    {/* KẾT LUẬN */}
                    {safeStr(report.content?.hiring_conclusion) && (
                      <div className="p-4">
                        <div className="text-[#3b82f6] font-semibold text-xs mb-1 uppercase tracking-wide">
                          KẾT LUẬN
                        </div>
                        <div className="text-cyan-500/40 text-xs mb-2">
                          ────────────────────────
                        </div>
                        <div className="text-white/85 text-sm whitespace-pre-wrap leading-relaxed">
                          {stripHtml(
                            safeStr(report.content?.hiring_conclusion),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Edit mode: separate textareas per field ────────────── */}
                {editing && (
                  <div className="space-y-3">
                    {SECTIONS.map((section) => {
                      const value = draft?.[section.key] ?? "";
                      return (
                        <div
                          key={section.key}
                          className="rounded-lg border border-[#313131] bg-[#0d1c2d] p-3"
                        >
                          <label className="block text-[#3b82f6] font-semibold text-xs mb-1.5 uppercase tracking-wide">
                            {section.label}
                          </label>
                          <textarea
                            value={value}
                            onChange={(e) =>
                              setDraft((prev) =>
                                prev
                                  ? { ...prev, [section.key]: e.target.value }
                                  : prev,
                              )
                            }
                            placeholder={section.placeholder}
                            rows={
                              section.key === "candidate_name" ||
                              section.key === "position"
                                ? 1
                                : section.key === "hiring_conclusion"
                                  ? 3
                                  : 5
                            }
                            className="w-full bg-[#071524] border border-slate-700 rounded-md px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 resize-y"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Score field when editing */}
                {editing && (
                  <div className="rounded-lg border border-[#313131] bg-[#0d1c2d] p-3">
                    <label className="block text-[#3b82f6] font-semibold text-xs mb-1.5 uppercase tracking-wide">
                      Điểm tổng (0 - 10)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={10}
                      value={draftScore}
                      onChange={(e) => setDraftScore(e.target.value)}
                      placeholder="Để trống nếu chưa có"
                      className="w-40 bg-[#071524] border border-slate-700 rounded-md px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
                    />
                  </div>
                )}

                {/* Footer info */}
                <div className="text-xs text-white/40 border-t border-[#313131] pt-3">
                  Mỗi buổi phỏng vấn có thể có nhiều báo cáo. Bấm "Tạo bản mới"
                  để AI sinh thêm một phiên bản độc lập (mỗi lần tạo đều thêm 1
                  báo cáo mới vào danh sách bên trái).
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
