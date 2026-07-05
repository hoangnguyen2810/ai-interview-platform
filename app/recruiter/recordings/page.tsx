"use client";

import { SideNavBar } from "@/app/components/SideNavBar";
import { TopNavBar } from "@/app/components/TopNavBar";
import {
  MoreHorizontal,
  Search,
  PlayCircle,
  CalendarDays,
  Clock3,
  Download,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface RecordingDto {
  id: string;
  interviewId: string;
  meetingCode: string;
  title: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
  status: "PROCESSING" | "AVAILABLE" | "FAILED";
  recordedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse {
  success: boolean;
  recordings?: RecordingDto[];
  total?: number;
  message?: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "AVAILABLE":
      return "bg-green-500/15 text-green-400 border border-green-500/30";
    case "PROCESSING":
      return "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30";
    case "FAILED":
      return "bg-red-500/15 text-red-400 border border-red-500/30";
    default:
      return "bg-slate-500/15 text-slate-300 border border-slate-500/30";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "AVAILABLE":
      return "Sẵn sàng";
    case "PROCESSING":
      return "Đang xử lý";
    case "FAILED":
      return "Thất bại";
    default:
      return status;
  }
};

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(value: string): string {
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<RecordingDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "AVAILABLE" | "PROCESSING" | "FAILED"
  >("ALL");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const token =
          typeof window !== "undefined"
            ? window.localStorage.getItem("token")
            : null;
        const headers: HeadersInit = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch("/api/recordings?limit=200", {
          headers,
          credentials: "include",
        });
        const json = (await res.json().catch(() => null)) as ApiResponse | null;

        if (cancelled) return;

        if (!res.ok || !json?.success) {
          setError(json?.message ?? `Không thể tải recordings (${res.status})`);
          setRecordings([]);
        } else {
          setRecordings(json.recordings ?? []);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Lỗi không xác định");
        setRecordings([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recordings.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.meetingCode.toLowerCase().includes(q) ||
        r.fileName.toLowerCase().includes(q)
      );
    });
  }, [recordings, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: recordings.length,
      available: recordings.filter((r) => r.status === "AVAILABLE").length,
      processing: recordings.filter((r) => r.status === "PROCESSING").length,
      failed: recordings.filter((r) => r.status === "FAILED").length,
    };
  }, [recordings]);

  return (
    <>
      <TopNavBar />
      <SideNavBar />

      <main className="ml-sidebar-width pt-20 px-10 pb-10 min-h-screen bg-[#071524] text-white">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Quản lý Recordings
            </h1>
            <p className="text-slate-400 mt-2">
              Quản lý video ghi lại các buổi phỏng vấn
            </p>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-10">
          <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-6">
            <p className="text-slate-400 text-sm">Tổng recordings</p>
            <h2 className="text-4xl font-bold mt-3">{stats.total}</h2>
          </div>

          <div className="bg-[#0F1E2E] border border-green-500/10 rounded-2xl p-6">
            <p className="text-slate-400 text-sm">Sẵn sàng</p>
            <h2 className="text-4xl font-bold text-green-400 mt-3">
              {stats.available}
            </h2>
          </div>

          <div className="bg-[#0F1E2E] border border-yellow-500/10 rounded-2xl p-6">
            <p className="text-slate-400 text-sm">Đang xử lý</p>
            <h2 className="text-4xl font-bold text-yellow-400 mt-3">
              {stats.processing}
            </h2>
          </div>

          <div className="bg-[#0F1E2E] border border-red-500/10 rounded-2xl p-6">
            <p className="text-slate-400 text-sm">Thất bại</p>
            <h2 className="text-4xl font-bold text-red-400 mt-3">
              {stats.failed}
            </h2>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-6 mb-10">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                placeholder="Tìm kiếm recording..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#071524] border border-slate-700 rounded-xl pl-11 pr-4 py-3 outline-none focus:border-cyan-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as typeof statusFilter)
              }
              className="bg-[#071524] border border-slate-700 rounded-xl px-4 py-3 min-w-[160px]"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="AVAILABLE">Sẵn sàng</option>
              <option value="PROCESSING">Đang xử lý</option>
              <option value="FAILED">Thất bại</option>
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl overflow-hidden shadow-lg shadow-black/20">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-10 flex items-center justify-center gap-3 text-slate-400">
                <Loader2 className="animate-spin" size={20} />
                <span>Đang tải recordings...</span>
              </div>
            ) : error ? (
              <div className="p-10 flex items-center justify-center gap-3 text-red-300">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                {recordings.length === 0
                  ? "Chưa có recording nào. Bật ghi hình khi tạo phòng để bắt đầu thu thập."
                  : "Không tìm thấy recording phù hợp với bộ lọc."}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-[#13263a] text-sm">
                  <tr className="text-left text-slate-300">
                    <th className="p-5">Tiêu đề</th>
                    <th className="p-5">Mã</th>
                    <th className="p-5">Trạng thái</th>
                    <th className="p-5">Thời lượng</th>
                    <th className="p-5">Dung lượng</th>
                    <th className="p-5">Thời gian</th>
                    <th className="p-5 text-center">Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-slate-800 hover:bg-cyan-500/5 transition"
                    >
                      <td className="p-5 font-medium flex items-center gap-2">
                        <PlayCircle size={16} className="text-cyan-400" />
                        {item.title}
                      </td>

                      <td className="p-5 text-cyan-400 font-medium">
                        {item.meetingCode}
                      </td>

                      <td className="p-5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusColor(
                            item.status,
                          )}`}
                        >
                          {getStatusLabel(item.status)}
                        </span>
                      </td>

                      <td className="p-5 flex items-center gap-1">
                        <Clock3 size={14} />
                        {formatDuration(item.durationSeconds)}
                      </td>

                      <td className="p-5">{formatSize(item.sizeBytes)}</td>

                      <td className="p-5 flex items-center gap-1">
                        <CalendarDays size={14} />
                        {formatDate(item.createdAt)}
                      </td>

                      <td className="p-5">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            disabled={item.status !== "AVAILABLE"}
                            onClick={() =>
                              item.status === "AVAILABLE" &&
                              setPreviewUrl(item.fileUrl)
                            }
                            className="p-2 rounded-lg hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Xem"
                          >
                            <PlayCircle size={18} />
                          </button>

                          <a
                            href={item.fileUrl}
                            download={item.fileName}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg hover:bg-slate-700 transition"
                            title="Tải xuống"
                          >
                            <Download size={18} />
                          </a>

                          <button
                            type="button"
                            disabled
                            className="p-2 rounded-lg hover:bg-red-500/20 transition text-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Xóa (chưa hỗ trợ)"
                          >
                            <Trash2 size={18} />
                          </button>

                          <button
                            type="button"
                            className="p-2 rounded-lg hover:bg-slate-700 transition"
                            title="Chi tiết"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Modal xem trước recording */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="w-full max-w-4xl bg-[#0B1120] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="font-semibold">Xem recording</h3>
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="px-3 py-1 rounded-lg border border-white/10 text-sm hover:bg-white/5"
              >
                Đóng
              </button>
            </div>
            <div className="bg-black">
              <video
                src={previewUrl}
                controls
                autoPlay
                className="w-full max-h-[70vh]"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}