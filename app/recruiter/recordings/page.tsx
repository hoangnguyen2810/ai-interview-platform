"use client";

import { SideNavBar } from "@/app/components/SideNavBar";
import { TopNavBar } from "@/app/components/TopNavBar";
import {
  Search,
  PlayCircle,
  CalendarDays,
  Clock3,
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface RecordingDto {
  id: string;
  callCid: string;
  url: string;
  filename: string | null;
  duration: number;
  recordingType: string | null;
  createdAt: string;
}

interface ApiResponse {
  success: boolean;
  recordings?: RecordingDto[];
  total?: number;
  message?: string;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
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

/**
 * Lấy phần meetingCode từ callCid (vd "default:NC-ABC123" → "NC-ABC123").
 * CallCid có thể có nhiều dấu ":" nên join phần còn lại.
 */
function meetingCodeFromCid(callCid: string): string {
  if (!callCid) return "";
  const idx = callCid.indexOf(":");
  return idx < 0 ? callCid : callCid.slice(idx + 1);
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<RecordingDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncInput, setSyncInput] = useState("");
  const [syncMessage, setSyncMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const loadRecordings = useCallback(async () => {
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

      if (!res.ok || !json?.success) {
        setError(json?.message ?? `Không thể tải recordings (${res.status})`);
        setRecordings([]);
      } else {
        setRecordings(json.recordings ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
      setRecordings([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecordings();
  }, [loadRecordings]);

  /**
   * Gọi GET /api/recordings/:callCid để server fetch từ GetStream rồi
   * INSERT vào DB. User nhập callCid (vd "default:NC-ABC123") vào ô input,
   * bấm nút → endpoint chạy → reload list.
   */
  const handleSyncCallCid = useCallback(async () => {
    const callCid = syncInput.trim();
    if (!callCid || isSyncing) return;

    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("token")
          : null;
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(
        `/api/recordings/${encodeURIComponent(callCid)}`,
        { method: "GET", headers, credentials: "include" },
      );
      const json = (await res.json().catch(() => null)) as ApiResponse | null;

      if (!res.ok || !json?.success) {
        setSyncMessage({
          type: "error",
          text: json?.message ?? `Lỗi ${res.status}`,
        });
        return;
      }

      const inserted = json.total ?? 0;
      setSyncMessage({
        type:
          inserted > 0
            ? "success"
            : (json.message?.includes("đang") ? "info" : "success"),
        text:
          json.message ??
          `Đồng bộ xong: ${inserted} recording đã được lưu`,
      });
      await loadRecordings();
    } catch (err) {
      setSyncMessage({
        type: "error",
        text:
          err instanceof Error
            ? `Lỗi: ${err.message}`
            : "Đồng bộ thất bại",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [syncInput, isSyncing, loadRecordings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recordings.filter((r) => {
      if (!q) return true;
      const code = meetingCodeFromCid(r.callCid);
      return (
        code.toLowerCase().includes(q) ||
        r.callCid.toLowerCase().includes(q) ||
        (r.filename ?? "").toLowerCase().includes(q) ||
        (r.recordingType ?? "").toLowerCase().includes(q)
      );
    });
  }, [recordings, search]);

  return (
    <>
      <TopNavBar />
      <SideNavBar />

      <main className="ml-sidebar-width pt-20 px-10 pb-10 min-h-screen bg-[#071524] text-white">
        {/* HEADER */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">
            Quản lý Recordings
          </h1>
          <p className="text-slate-400 mt-2">
            Recordings được lưu từ GetStream khi host End Call. Nhập
            <code className="mx-1 px-1.5 py-0.5 bg-slate-800 rounded text-cyan-400 text-sm">
              default:&lt;meetingCode&gt;
            </code>
            để đồng bộ recording cho 1 cuộc phỏng vấn.
          </p>
        </div>

        {/* SYNC PANEL */}
        <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-6 mb-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <RefreshCw size={18} className="text-cyan-400" />
            Đồng bộ recording từ GetStream
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={syncInput}
              onChange={(e) => setSyncInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSyncCallCid();
              }}
              placeholder="default:NC-XXXXXX"
              className="flex-1 bg-[#071524] border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-cyan-500 font-mono text-sm"
              disabled={isSyncing}
            />
            <button
              type="button"
              onClick={() => void handleSyncCallCid()}
              disabled={!syncInput.trim() || isSyncing}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-[#071524] font-semibold transition shadow-lg shadow-cyan-500/20 min-w-[180px]"
            >
              <RefreshCw
                size={18}
                className={isSyncing ? "animate-spin" : ""}
              />
              {isSyncing ? "Đang đồng bộ..." : "Đồng bộ"}
            </button>
          </div>

          {syncMessage && (
            <div
              className={`mt-4 p-3 rounded-xl border flex items-start gap-3 ${
                syncMessage.type === "success"
                  ? "bg-green-500/10 border-green-500/30 text-green-300"
                  : syncMessage.type === "error"
                    ? "bg-red-500/10 border-red-500/30 text-red-300"
                    : "bg-slate-500/10 border-slate-500/30 text-slate-300"
              }`}
            >
              {syncMessage.type === "success" ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              ) : (
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
              )}
              <span className="text-sm flex-1">{syncMessage.text}</span>
              <button
                type="button"
                onClick={() => setSyncMessage(null)}
                className="ml-auto text-xs px-2 py-1 rounded hover:bg-white/10"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* SEARCH */}
        <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-6 mb-10">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              placeholder="Tìm theo meeting code, callCid, filename, recording type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#071524] border border-slate-700 rounded-xl pl-11 pr-4 py-3 outline-none focus:border-cyan-500"
            />
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
                  ? "Chưa có recording nào. Nhập callCid ở trên để đồng bộ từ GetStream."
                  : "Không tìm thấy recording phù hợp."}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-[#13263a] text-sm">
                  <tr className="text-left text-slate-300">
                    <th className="p-5">Call CID</th>
                    <th className="p-5">Meeting</th>
                    <th className="p-5">Filename</th>
                    <th className="p-5">Type</th>
                    <th className="p-5">Thời lượng</th>
                    <th className="p-5">Thời gian</th>
                    <th className="p-5 text-center">Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((item) => {
                    const code = meetingCodeFromCid(item.callCid);
                    return (
                      <tr
                        key={item.id}
                        className="border-t border-slate-800 hover:bg-cyan-500/5 transition"
                      >
                        <td className="p-5 font-mono text-xs text-cyan-400">
                          {item.callCid}
                        </td>
                        <td className="p-5 font-medium text-white">
                          {code}
                        </td>
                        <td className="p-5 text-slate-300 max-w-xs truncate">
                          {item.filename ?? "—"}
                        </td>
                        <td className="p-5">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            <Video size={12} />
                            {item.recordingType ?? "—"}
                          </span>
                        </td>
                        <td className="p-5 flex items-center gap-1">
                          <Clock3 size={14} />
                          {formatDuration(item.duration)}
                        </td>
                        <td className="p-5 flex items-center gap-1">
                          <CalendarDays size={14} />
                          {formatDate(item.createdAt)}
                        </td>
                        <td className="p-5">
                          <div className="flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewUrl(item.url)}
                              className="p-2 rounded-lg hover:bg-slate-700 transition text-cyan-400"
                              title="Xem"
                            >
                              <PlayCircle size={18} />
                            </button>

                            <a
                              href={item.url}
                              download={item.filename ?? undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-lg hover:bg-slate-700 transition"
                              title="Tải xuống"
                            >
                              <Download size={18} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
