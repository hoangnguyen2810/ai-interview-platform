"use client";

import { useEffect, useState, useCallback } from "react";

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

function statusBadgeClass(status: string): string {
  switch (status) {
    case "FINAL":
      return "bg-green-500/15 text-green-400 border-green-500/30";
    case "EDITED":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "DRAFT":
    default:
      return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
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
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ReportContent | null>(null);
  const [draftScore, setDraftScore] = useState<string>("");

  const loadReport = useCallback(async () => {
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
      setReport(data.report ?? null);
      onReportChanged?.(data.report ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải báo cáo");
    } finally {
      setLoading(false);
    }
  }, [meetingCode, onReportChanged]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

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
      setReport(data.report);
      setEditing(false);
      setSuccess("Đã tạo báo cáo AI");
      onReportChanged?.(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tạo báo cáo");
    } finally {
      setGenerating(false);
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
    if (!draft) return;
    try {
      setSaving(true);
      setError(null);
      const scoreNum =
        draftScore.trim() === ""
          ? null
          : Number.parseFloat(draftScore);
      if (
        draftScore.trim() !== "" &&
        (Number.isNaN(scoreNum) || scoreNum! < 0 || scoreNum! > 10)
      ) {
        throw new Error("Điểm tổng phải nằm trong [0, 10]");
      }

      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/report`,
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
      setReport(data.report);
      setEditing(false);
      setDraft(null);
      setSuccess("Đã lưu báo cáo");
      onReportChanged?.(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi lưu báo cáo");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkFinal = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/report`,
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
      setReport(data.report);
      setSuccess("Đã đánh dấu báo cáo là Hoàn tất");
      onReportChanged?.(data.report);
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
        className="bg-[#0a1929] border border-cyan-500/30 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20 bg-[#122131] rounded-t-xl">
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-cyan-400">
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
            className={`px-4 py-2 text-sm border-b border-cyan-500/10 ${
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
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold transition shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[#0d1c2d] border border-cyan-500/10">
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
                      <span className="text-cyan-300 font-semibold">
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
                        className="px-3 py-1.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-colors flex items-center gap-1"
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
                        {generating ? "Đang tạo..." : "Tạo lại"}
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
                    </>
                  )}
                  {editing && (
                    <>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="px-3 py-1.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
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

              {/* Sections */}
              <div className="space-y-3">
                {SECTIONS.map((section) => {
                  const value = editing
                    ? (draft?.[section.key] ?? "")
                    : (report.content?.[section.key] ?? "");
                  return (
                    <div
                      key={section.key}
                      className="rounded-lg border border-cyan-500/10 bg-[#0d1c2d] p-3"
                    >
                      <label className="block text-cyan-400 font-semibold text-xs mb-1.5 uppercase tracking-wide">
                        {section.label}
                      </label>
                      {editing ? (
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
                      ) : (
                        <div className="text-white/85 text-sm whitespace-pre-wrap leading-relaxed">
                          {value?.toString().trim()
                            ? value
                            : "—"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Score field when editing */}
              {editing && (
                <div className="rounded-lg border border-cyan-500/10 bg-[#0d1c2d] p-3">
                  <label className="block text-cyan-400 font-semibold text-xs mb-1.5 uppercase tracking-wide">
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
              <div className="text-xs text-white/40 border-t border-cyan-500/10 pt-3">
                Mỗi buổi phỏng vấn có tối đa 1 báo cáo. Bấm "Tạo lại" để AI sinh
                lại từ dữ liệu mới nhất (sẽ ghi đè nội dung hiện tại).
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}