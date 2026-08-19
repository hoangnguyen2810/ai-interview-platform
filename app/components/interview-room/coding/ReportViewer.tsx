"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";

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

// FIX (mất dữ liệu khi lưu): AI đôi khi trả về 1 field dưới dạng mảng
// (ví dụ strengths: ["a", "b"]) thay vì string, dù type ReportContent khai
// là string — TypeScript không enforce việc này ở runtime, và cột `content`
// trong DB là jsonb nên lưu kiểu gì cũng được.
//
// Trước đây, khi bắt đầu edit, `draft` được gán trực tiếp bằng
// `{...report.content}` nên field dạng mảng đó vẫn giữ nguyên là mảng bên
// trong state. Nếu recruiter không tự tay sửa field đó rồi bấm Lưu, backend
// (sanitizeContent) sẽ thấy field không phải string và ÂM THẦM reset nó về
// "" — dữ liệu AI sinh ra bị mất.
//
// Hàm này ép MỌI giá trị (string/mảng/object/number/...) thành text có thể
// edit ngay từ lúc vào edit mode, để (1) không còn field nào là non-string
// bị đẩy lên backend, và (2) recruiter vẫn nhìn thấy & chỉnh sửa được nội
// dung đó dưới dạng gạch đầu dòng thay vì bị ẩn hoàn toàn.
function toEditableText(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val.trim();
  if (Array.isArray(val)) {
    return val
      .map((item) => (typeof item === "string" ? item.trim() : safeStr(item)))
      .filter(Boolean)
      .map((item) => `- ${item}`)
      .join("\n");
  }
  if (typeof val === "object") {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return "";
    }
  }
  return String(val).trim();
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

// UI: bảng màu accent cho từng mục trong chế độ xem, giúp phân biệt
// nhanh và làm nổi bật nội dung thay vì dùng chung 1 màu xanh cho tất cả.
const SECTION_STYLES = {
  info: {
    icon: "badge",
    label: "text-cyan-400",
    border: "border-l-cyan-500",
    ring: "border-cyan-500/20",
    bg: "bg-cyan-500/[0.05]",
  },
  summary: {
    icon: "summarize",
    label: "text-indigo-400",
    border: "border-l-indigo-500",
    ring: "border-indigo-500/20",
    bg: "bg-indigo-500/[0.05]",
  },
  skill: {
    icon: "psychology",
    label: "text-amber-400",
    border: "border-l-amber-500",
    ring: "border-amber-500/20",
    bg: "bg-amber-500/[0.05]",
  },
  strengths: {
    icon: "thumb_up",
    label: "text-emerald-400",
    border: "border-l-emerald-500",
    ring: "border-emerald-500/20",
    bg: "bg-emerald-500/[0.05]",
  },
  improve: {
    icon: "trending_up",
    label: "text-orange-400",
    border: "border-l-orange-500",
    ring: "border-orange-500/20",
    bg: "bg-orange-500/[0.05]",
  },
  conclusion: {
    icon: "gavel",
    label: "text-fuchsia-400",
    border: "border-l-fuchsia-500",
    ring: "border-fuchsia-500/20",
    bg: "bg-fuchsia-500/[0.05]",
  },
} as const;

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

// ── Resizable modal constants ─────────────────────────────────────────────
const MIN_MODAL_WIDTH = 760;
const MIN_MODAL_HEIGHT = 420;
const DEFAULT_MODAL_WIDTH = 1320; // ~ max-w-[1400px], rộng hơn để đọc báo cáo thoải mái
const DEFAULT_MODAL_HEIGHT_RATIO = 0.94; // ~ h-[94vh]

type ResizeDirection = "e" | "s" | "se" | "w" | "sw";

interface DragOffset {
  x: number;
  y: number;
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

  // ── Resizable modal state ────────────────────────────────────────────
  // null width/height means "use default responsive sizing" until the user
  // performs their first manual resize.
  const [modalSize, setModalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const resizeStateRef = useRef<{
    direction: ResizeDirection;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  // ── Draggable modal state ────────────────────────────────────────────
  // The modal is centered by its flex parent; dragOffset is an additional
  // translate() applied on top of that centered position.
  const [dragOffset, setDragOffset] = useState<DragOffset>({ x: 0, y: 0 });
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  const getInitialSize = useCallback(() => {
    if (typeof window === "undefined") {
      return { width: DEFAULT_MODAL_WIDTH, height: 700 };
    }
    return {
      width: Math.min(DEFAULT_MODAL_WIDTH, window.innerWidth - 32),
      height: Math.min(
        window.innerHeight * DEFAULT_MODAL_HEIGHT_RATIO,
        window.innerHeight - 32,
      ),
    };
  }, []);

  const handleResizeStart = useCallback(
    (direction: ResizeDirection) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = modalRef.current?.getBoundingClientRect();
      const current = modalSize ?? getInitialSize();
      resizeStateRef.current = {
        direction,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: rect?.width ?? current.width,
        startHeight: rect?.height ?? current.height,
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor =
        direction === "e" || direction === "w"
          ? "ew-resize"
          : direction === "s"
            ? "ns-resize"
            : "nwse-resize";
    },
    [modalSize, getInitialSize],
  );

  // Start dragging the modal from the header. Ignores clicks that land on
  // buttons/icons (close, reset-layout, etc.) so those keep working normally.
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button")) return;
      e.preventDefault();
      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: dragOffset.x,
        startOffsetY: dragOffset.y,
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
    },
    [dragOffset],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rs = resizeStateRef.current;
      if (rs) {
        const dx = e.clientX - rs.startX;
        const dy = e.clientY - rs.startY;

        let nextWidth = rs.startWidth;
        if (rs.direction.includes("e")) {
          nextWidth = rs.startWidth + dx;
        } else if (rs.direction.includes("w")) {
          nextWidth = rs.startWidth - dx;
        }
        let nextHeight = rs.startHeight;
        if (rs.direction.includes("s")) {
          nextHeight = rs.startHeight + dy;
        }

        const maxWidth = window.innerWidth - 32;
        const maxHeight = window.innerHeight - 32;

        nextWidth = Math.min(Math.max(nextWidth, MIN_MODAL_WIDTH), maxWidth);
        nextHeight = Math.min(
          Math.max(nextHeight, MIN_MODAL_HEIGHT),
          maxHeight,
        );

        setModalSize({ width: nextWidth, height: nextHeight });
        return;
      }

      const ds = dragStateRef.current;
      if (ds) {
        const rect = modalRef.current?.getBoundingClientRect();
        const width = rect?.width ?? getInitialSize().width;
        const height = rect?.height ?? getInitialSize().height;
        const originalLeft = (window.innerWidth - width) / 2;
        const originalTop = (window.innerHeight - height) / 2;

        // Keep at least 100px of the modal visible horizontally, and keep
        // the header reachable vertically, so the user can always grab it
        // again after dragging it near an edge.
        const minFinalLeft = -(width - 100);
        const maxFinalLeft = window.innerWidth - 100;
        const minFinalTop = 0;
        const maxFinalTop = window.innerHeight - 60;

        const minX = minFinalLeft - originalLeft;
        const maxX = maxFinalLeft - originalLeft;
        const minY = minFinalTop - originalTop;
        const maxY = maxFinalTop - originalTop;

        const dx = e.clientX - ds.startX;
        const dy = e.clientY - ds.startY;

        let nextX = ds.startOffsetX + dx;
        let nextY = ds.startOffsetY + dy;

        nextX = Math.min(Math.max(nextX, minX), maxX);
        nextY = Math.min(Math.max(nextY, minY), maxY);

        setDragOffset({ x: nextX, y: nextY });
      }
    };

    const handleMouseUp = () => {
      if (resizeStateRef.current) {
        resizeStateRef.current = null;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }
      if (dragStateRef.current) {
        dragStateRef.current = null;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [getInitialSize]);

  const handleResetLayout = useCallback(() => {
    setModalSize(null);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  // UI: đóng bằng phím Esc — thay thế cho click-ra-ngoài đã bị bỏ, để vẫn
  // có cách đóng nhanh nhưng không dễ đóng nhầm khi đang thao tác.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
    // FIX (mất dữ liệu khi lưu): dùng toEditableText cho từng field thay vì
    // spread trực tiếp {...report.content}. Đảm bảo mọi giá trị đưa vào
    // draft (và sau này gửi lên PATCH) luôn là string — không còn field nào
    // "vô hình" bị backend xoá do sai kiểu (mảng/object) nữa.
    const raw = report.content as unknown as Record<string, unknown>;
    const safeContent: ReportContent = {
      candidate_name: toEditableText(raw.candidate_name),
      position: toEditableText(raw.position),
      summary: toEditableText(raw.summary),
      strengths: toEditableText(raw.strengths),
      weaknesses: toEditableText(raw.weaknesses),
      skill_evaluation: toEditableText(raw.skill_evaluation),
      improvement_suggestions: toEditableText(raw.improvement_suggestions),
      hiring_conclusion: toEditableText(raw.hiring_conclusion),
    };
    setDraft(safeContent);
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

  const effectiveSize = modalSize;
  const hasCustomLayout =
    modalSize !== null || dragOffset.x !== 0 || dragOffset.y !== 0;

  return (
    // UI: bỏ onClick={onClose} ở overlay — trước đây lỡ click/kéo chuột ra
    // ngoài modal (kể cả khi đang bôi đen văn bản) sẽ đóng và mất thao tác
    // đang làm. Giờ chỉ đóng qua nút X hoặc phím Esc.
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div
        ref={modalRef}
        className={`relative bg-[#18181B] border border-cyan-500/30 rounded-xl flex shadow-2xl ${
          effectiveSize ? "" : "w-full max-w-[1400px] h-[94vh]"
        }`}
        style={{
          ...(effectiveSize
            ? {
                width: effectiveSize.width,
                height: effectiveSize.height,
                maxWidth: "96vw",
                maxHeight: "96vh",
              }
            : {}),
          transform:
            dragOffset.x !== 0 || dragOffset.y !== 0
              ? `translate(${dragOffset.x}px, ${dragOffset.y}px)`
              : undefined,
        }}
      >
        {/* Sidebar — list of reports */}
        <div className="w-72 shrink-0 border-r border-[#313131] bg-[#161618] rounded-l-xl flex flex-col">
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
          {/* Header — also doubles as the drag handle for moving the modal */}
          <div
            onMouseDown={handleDragStart}
            className="flex items-center justify-between px-4 py-3 border-b border-[#313131] bg-[#202024] rounded-tr-xl cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="material-symbols-outlined text-white/20">
                drag_indicator
              </span>
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
            <div className="flex items-center gap-2">
              {hasCustomLayout && (
                <button
                  type="button"
                  onClick={handleResetLayout}
                  title="Đặt lại vị trí & kích thước mặc định"
                  className="text-white/40 hover:text-white transition-colors p-1"
                  aria-label="Đặt lại vị trí và kích thước"
                >
                  <span className="material-symbols-outlined text-lg">
                    fit_screen
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-white/50 hover:text-white transition-colors p-1"
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
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
                  className="px-5 py-2.5 rounded-xl bg-[#5E6AD2] hover:bg-[#6C78E8] text-white font-semibold transition-all duration-200 shadow-lg shadow-[#5E6AD2]/20 hover:shadow-[#5E6AD2]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Đang tạo báo cáo AI...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base ">
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
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#202124] border border-[#323438]">
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

                {/* ── View mode: mỗi mục là 1 card riêng, có màu accent
                    khác nhau để dễ phân biệt và làm nổi bật nội dung ──── */}
                {!editing && (
                  <div className="space-y-3">
                    {/* THÔNG TIN ỨNG VIÊN */}
                    <div
                      className={`rounded-xl border ${SECTION_STYLES.info.ring} ${SECTION_STYLES.info.bg} border-l-4 ${SECTION_STYLES.info.border} p-4`}
                    >
                      <div
                        className={`${SECTION_STYLES.info.label} font-semibold text-xs mb-3 uppercase tracking-wide flex items-center gap-1.5`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {SECTION_STYLES.info.icon}
                        </span>
                        Thông tin ứng viên
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-white/85">
                        <div>
                          <div className="text-white/40 text-[11px] uppercase tracking-wide mb-0.5">
                            Tên ứng viên
                          </div>
                          <div className="text-white font-medium">
                            {safeStr(report.content?.candidate_name) || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/40 text-[11px] uppercase tracking-wide mb-0.5">
                            Vị trí ứng tuyển
                          </div>
                          <div className="text-white font-medium">
                            {safeStr(report.content?.position) || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/40 text-[11px] uppercase tracking-wide mb-0.5">
                            Điểm tổng
                          </div>
                          <div className="text-cyan-300 font-bold">
                            {report.ai_overall_score != null
                              ? `${report.ai_overall_score.toFixed(1)} / 10`
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* TÓM TẮT */}
                    {safeStr(report.content?.summary) && (
                      <div
                        className={`rounded-xl border ${SECTION_STYLES.summary.ring} ${SECTION_STYLES.summary.bg} border-l-4 ${SECTION_STYLES.summary.border} p-4`}
                      >
                        <div
                          className={`${SECTION_STYLES.summary.label} font-semibold text-xs mb-2 uppercase tracking-wide flex items-center gap-1.5`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {SECTION_STYLES.summary.icon}
                          </span>
                          Tóm tắt
                        </div>
                        <div className="text-white/85 text-sm whitespace-pre-wrap leading-relaxed">
                          {stripHtml(safeStr(report.content?.summary))}
                        </div>
                      </div>
                    )}

                    {/* ĐÁNH GIÁ KỸ NĂNG */}
                    {safeStr(report.content?.skill_evaluation) && (
                      <div
                        className={`rounded-xl border ${SECTION_STYLES.skill.ring} ${SECTION_STYLES.skill.bg} border-l-4 ${SECTION_STYLES.skill.border} p-4`}
                      >
                        <div
                          className={`${SECTION_STYLES.skill.label} font-semibold text-xs mb-2 uppercase tracking-wide flex items-center gap-1.5`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {SECTION_STYLES.skill.icon}
                          </span>
                          Đánh giá kỹ năng
                        </div>
                        <div className="text-white/85 text-sm whitespace-pre-wrap leading-relaxed">
                          {stripHtml(safeStr(report.content?.skill_evaluation))}
                        </div>
                      </div>
                    )}

                    {/* ĐIỂM MẠNH */}
                    {safeStr(report.content?.strengths) && (
                      <div
                        className={`rounded-xl border ${SECTION_STYLES.strengths.ring} ${SECTION_STYLES.strengths.bg} border-l-4 ${SECTION_STYLES.strengths.border} p-4`}
                      >
                        <div
                          className={`${SECTION_STYLES.strengths.label} font-semibold text-xs mb-2 uppercase tracking-wide flex items-center gap-1.5`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {SECTION_STYLES.strengths.icon}
                          </span>
                          Điểm mạnh
                        </div>
                        <div className="text-white/85 text-sm whitespace-pre-wrap leading-relaxed">
                          {stripHtml(safeStr(report.content?.strengths))}
                        </div>
                      </div>
                    )}

                    {/* ĐIỂM CẦN CẢI THIỆN */}
                    {safeStr(report.content?.weaknesses) ||
                    safeStr(report.content?.improvement_suggestions) ? (
                      <div
                        className={`rounded-xl border ${SECTION_STYLES.improve.ring} ${SECTION_STYLES.improve.bg} border-l-4 ${SECTION_STYLES.improve.border} p-4`}
                      >
                        <div
                          className={`${SECTION_STYLES.improve.label} font-semibold text-xs mb-2 uppercase tracking-wide flex items-center gap-1.5`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {SECTION_STYLES.improve.icon}
                          </span>
                          Điểm cần cải thiện
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

                    {/* KẾT LUẬN — nhấn mạnh nhất, viền dày + nền đậm hơn 1 chút */}
                    {safeStr(report.content?.hiring_conclusion) && (
                      <div
                        className={`rounded-xl border-2 ${SECTION_STYLES.conclusion.ring} bg-fuchsia-500/[0.08] border-l-4 ${SECTION_STYLES.conclusion.border} p-4`}
                      >
                        <div
                          className={`${SECTION_STYLES.conclusion.label} font-semibold text-xs mb-2 uppercase tracking-wide flex items-center gap-1.5`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {SECTION_STYLES.conclusion.icon}
                          </span>
                          Kết luận
                        </div>
                        <div className="text-white text-sm whitespace-pre-wrap leading-relaxed font-medium">
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

        {/* ── Resize handles ──────────────────────────────────────────── */}
        {/* Right edge */}
        <div
          onMouseDown={handleResizeStart("e")}
          className="absolute top-0 right-0 h-full w-2 cursor-ew-resize"
          style={{ transform: "translateX(50%)" }}
        />
        {/* Left edge */}
        <div
          onMouseDown={handleResizeStart("w")}
          className="absolute top-0 left-0 h-full w-2 cursor-ew-resize"
          style={{ transform: "translateX(-50%)" }}
        />
        {/* Bottom edge */}
        <div
          onMouseDown={handleResizeStart("s")}
          className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize"
          style={{ transform: "translateY(50%)" }}
        />
        {/* Bottom-right corner */}
        <div
          onMouseDown={handleResizeStart("se")}
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize flex items-end justify-end p-0.5"
          style={{ transform: "translate(25%, 25%)" }}
        >
          <span className="material-symbols-outlined text-white/25 hover:text-white/60 transition-colors text-sm leading-none">
            drag_indicator
          </span>
        </div>
        {/* Bottom-left corner */}
        <div
          onMouseDown={handleResizeStart("sw")}
          className="absolute bottom-0 left-0 h-4 w-4 cursor-nesw-resize"
          style={{ transform: "translate(-25%, 25%)" }}
        />
      </div>
    </div>
  );
}
