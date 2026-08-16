"use client";

import { SideNavBar } from "@/app/components/SideNavBar";
import { TopNavBar } from "@/app/components/TopNavBar";
import { Pagination } from "@/app/components/Pagination";
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
  Filter,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface RecordingDto {
  id: string;
  callCid: string;
  url: string;
  filename: string | null;
  duration: number;
  recordingType: string | null;
  interviewId?: string | null;
  interviewTitle?: string | null;
  createdAt: string;
}

interface ApiResponse {
  success: boolean;
  recordings?: RecordingDto[];
  total?: number;
  inserted?: number;
  skipped?: number;
  message?: string;
}

interface LatestInterview {
  callCid: string;
  meetingCode: string;
  title: string;
  status: string;
  createdAt: string;
}

interface LatestResponse {
  success: boolean;
  callCid: string | null;
  meetingCode?: string | null;
  title?: string | null;
  status?: string | null;
  createdAt?: string | null;
  message?: string;
}

type SortOption = "newest" | "oldest" | "duration_desc" | "duration_asc";

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

const btnBase =
  "min-w-[36px] h-9 px-3 inline-flex items-center justify-center rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<RecordingDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingLatest, setIsLoadingLatest] = useState(false);
  const [syncInput, setSyncInput] = useState("");
  const [latest, setLatest] = useState<LatestInterview | null>(null);
  const [syncMessage, setSyncMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
    /** Số recording MỚI được insert vào DB */
    inserted?: number;
    /** Số recording đã có sẵn, được skip để tránh trùng */
    skipped?: number;
  } | null>(null);

  // ----- BỘ LỌC -----
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const ITEMS_PER_PAGE = 5;

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, dateFrom, dateTo, sortBy]);

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
   * Helper gọi GET /api/recordings/:callCid. Trả { ok, json } để caller
   * tự xử lý message — dùng chung cho cả flow nhập tay và flow "mới nhất".
   */
  const syncByCallCid = useCallback(
    async (callCid: string): Promise<ApiResponse | null> => {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("token")
          : null;
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(
        `/api/recordings/${encodeURIComponent(callCid)}`,
        {
          method: "GET",
          headers,
          credentials: "include",
        },
      );
      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      return res.ok
        ? json
        : (json ?? { success: false, message: `HTTP ${res.status}` });
    },
    [],
  );

  /**
   * Lấy callCid của interview mới nhất từ server (recruiter không cần nhập
   * tay). Endpoint: GET /api/recordings/latest.
   */
  const loadLatest = useCallback(async (): Promise<LatestInterview | null> => {
    setIsLoadingLatest(true);
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("token")
          : null;
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/recordings/latest", {
        method: "GET",
        headers,
        credentials: "include",
      });
      const json = (await res
        .json()
        .catch(() => null)) as LatestResponse | null;

      if (!res.ok || !json?.success || !json.callCid) {
        setLatest(null);
        return null;
      }
      const info: LatestInterview = {
        callCid: json.callCid,
        meetingCode: json.meetingCode ?? "",
        title: json.title ?? "",
        status: json.status ?? "",
        createdAt: json.createdAt ?? "",
      };
      setLatest(info);
      return info;
    } catch {
      setLatest(null);
      return null;
    } finally {
      setIsLoadingLatest(false);
    }
  }, []);

  // Tự động load preview "interview mới nhất" khi mở trang để recruiter
  // thấy ngay callCid sẽ được sync — không cần đợi bấm nút mới biết.
  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

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
      const json = await syncByCallCid(callCid);

      if (!json?.success) {
        setSyncMessage({
          type: "error",
          text: json?.message ?? "Đồng bộ thất bại",
        });
        return;
      }

      const inserted = json.inserted ?? 0;
      const skipped = json.skipped ?? 0;
      setSyncMessage({
        type: inserted > 0 ? "success" : skipped > 0 ? "info" : "info",
        text: json.message ?? `Đồng bộ xong: ${inserted} mới, ${skipped} đã có`,
        inserted,
        skipped,
      });
      await loadRecordings();
    } catch (err) {
      setSyncMessage({
        type: "error",
        text: err instanceof Error ? `Lỗi: ${err.message}` : "Đồng bộ thất bại",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [syncInput, isSyncing, syncByCallCid, loadRecordings]);

  /**
   * Sync recording của interview MỚI NHẤT user từng host:
   *   1. Gọi /api/recordings/latest để lấy callCid.
   *   2. Gọi /api/recordings/:callCid để server fetch từ GetStream → DB.
   *
   * Flow 1 lần duy nhất, không cần nhập tay.
   */
  const handleSyncLatest = useCallback(async () => {
    if (isSyncing) return;
    setSyncMessage(null);

    const info = await loadLatest();
    if (!info) {
      setSyncMessage({
        type: "error",
        text: "Không tìm thấy interview nào để đồng bộ",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const json = await syncByCallCid(info.callCid);
      if (!json?.success) {
        setSyncMessage({
          type: "error",
          text: json?.message ?? "Đồng bộ thất bại",
        });
        return;
      }

      const inserted = json.inserted ?? 0;
      const skipped = json.skipped ?? 0;
      const tail =
        inserted > 0
          ? ` — ${inserted} mới, ${skipped} đã có`
          : skipped > 0
            ? ` — ${skipped} đã có sẵn`
            : "";

      setSyncMessage({
        type: inserted > 0 ? "success" : "info",
        text: `Đồng bộ "${info.title}" (${info.meetingCode})${tail}`,
        inserted,
        skipped,
      });
      await loadRecordings();
    } catch (err) {
      setSyncMessage({
        type: "error",
        text: err instanceof Error ? `Lỗi: ${err.message}` : "Đồng bộ thất bại",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, loadLatest, syncByCallCid, loadRecordings]);

  // Danh sách loại ghi hình có sẵn trong dữ liệu (để render dropdown động)
  const recordingTypes = useMemo(() => {
    const set = new Set<string>();
    recordings.forEach((r) => {
      if (r.recordingType) set.add(r.recordingType);
    });
    return Array.from(set);
  }, [recordings]);

  const hasActiveFilters =
    typeFilter !== "ALL" || !!dateFrom || !!dateTo || sortBy !== "newest";

  function resetFilters() {
    setTypeFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setSortBy("newest");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const fromTime = dateFrom
      ? new Date(dateFrom + "T00:00:00").getTime()
      : null;
    const toTime = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;

    const result = recordings.filter((r) => {
      const code = meetingCodeFromCid(r.callCid);

      const matchSearch =
        !q ||
        code.toLowerCase().includes(q) ||
        r.callCid.toLowerCase().includes(q) ||
        (r.filename ?? "").toLowerCase().includes(q) ||
        (r.interviewTitle ?? "").toLowerCase().includes(q) ||
        (r.recordingType ?? "").toLowerCase().includes(q);

      const matchType = typeFilter === "ALL" || r.recordingType === typeFilter;

      const createdTime = new Date(r.createdAt).getTime();
      const matchFrom = fromTime === null || createdTime >= fromTime;
      const matchTo = toTime === null || createdTime <= toTime;

      return matchSearch && matchType && matchFrom && matchTo;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "duration_desc":
          return b.duration - a.duration;
        case "duration_asc":
          return a.duration - b.duration;
        case "newest":
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });

    return result;
  }, [recordings, search, typeFilter, dateFrom, dateTo, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  const safePage = Math.min(currentPage, totalPages);

  const pageStart = (safePage - 1) * ITEMS_PER_PAGE;
  const pageEnd = pageStart + ITEMS_PER_PAGE;

  const paginatedRecordings = useMemo(
    () => filtered.slice(pageStart, pageEnd),
    [filtered, pageStart, pageEnd],
  );

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;

    setCurrentPage(page);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <>
      <TopNavBar />
      <SideNavBar />

      <main className="ml-sidebar-width pt-20 px-10 pb-10 min-h-screen bg-[#071524] text-white">
        {/* HEADER */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">
            Quản lý ghi hình
          </h1>
        </div>

        {/* SYNC PANEL */}
        <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-6 mb-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <RefreshCw size={18} className="text-cyan-400" />
            Đồng bộ dữ liệu từ GetStream
          </h2>

          {/* NÚT CHÍNH — sync interview mới nhất */}
          <div className="mb-5 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                {latest ? (
                  <div className="text-xs text-slate-400 font-mono truncate">
                    {latest.callCid} ·{" "}
                    <span className="text-slate-200">{latest.title}</span> ·{" "}
                    {latest.status}
                  </div>
                ) : isLoadingLatest ? (
                  <div className="text-xs text-slate-500">Đang tải…</div>
                ) : (
                  <div className="text-xs text-slate-500">
                    (chưa có dữ liệu — sẽ fetch khi bấm nút)
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleSyncLatest()}
                disabled={isSyncing}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold transition shadow-lg shadow-cyan-500/20 min-w-[220px] whitespace-nowrap"
              >
                <RefreshCw
                  size={18}
                  className={isSyncing ? "animate-spin" : ""}
                />
                {isSyncing ? "Đang đồng bộ…" : "Đồng bộ mới nhất"}
              </button>
            </div>
          </div>

          {/* FALLBACK — nhập callCid tay */}

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
              <div className="text-sm flex-1">
                <div>{syncMessage.text}</div>
                {(syncMessage.inserted !== undefined ||
                  syncMessage.skipped !== undefined) && (
                  <div className="flex flex-wrap gap-2 mt-2 text-xs">
                    {typeof syncMessage.inserted === "number" && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                          syncMessage.inserted > 0
                            ? "bg-green-500/20 border-green-500/40 text-green-200"
                            : "bg-slate-700/50 border-slate-600 text-slate-400"
                        }`}
                      >
                        <span className="font-mono font-bold">
                          +{syncMessage.inserted}
                        </span>
                        <span>mới</span>
                      </span>
                    )}
                    {typeof syncMessage.skipped === "number" &&
                      syncMessage.skipped > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-amber-500/15 border-amber-500/30 text-amber-200">
                          <span className="font-mono font-bold">
                            ={syncMessage.skipped}
                          </span>
                          <span>đã có</span>
                        </span>
                      )}
                  </div>
                )}
              </div>
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

        {/* SEARCH + FILTER */}
        <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-6 mb-10">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                placeholder="Tìm theo tên buổi phỏng vấn, meeting code,..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#071524] border border-slate-700 rounded-xl pl-11 pr-4 py-3 outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border transition whitespace-nowrap ${
                showFilters || hasActiveFilters
                  ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                  : "bg-[#071524] border-slate-700 hover:bg-slate-800"
              }`}
            >
              <Filter size={18} />
              Bộ lọc
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-5 pt-5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Loại ghi hình
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full bg-[#071524] border border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:border-cyan-500"
                >
                  <option value="ALL">Tất cả</option>
                  {recordingTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-[#071524] border border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-[#071524] border border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Sắp xếp
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full bg-[#071524] border border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:border-cyan-500"
                >
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                  <option value="duration_desc">Thời lượng: dài → ngắn</option>
                  <option value="duration_asc">Thời lượng: ngắn → dài</option>
                </select>
              </div>

              {hasActiveFilters && (
                <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition"
                  >
                    <X size={14} />
                    Xóa bộ lọc
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* TABLE */}
        <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl overflow-hidden shadow-lg shadow-black/20">
          <div className="overflow-x-auto custom-scrollbar">
            {isLoading ? (
              <div className="p-10 flex items-center justify-center gap-3 text-slate-400">
                <Loader2 className="animate-spin" size={20} />
                <span>Đang tải bản ghi hình...</span>
              </div>
            ) : error ? (
              <div className="p-10 flex items-center justify-center gap-3 text-red-300">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                {recordings.length === 0
                  ? "Chưa có bản ghi hình nào. Vui lòng đồng bộ"
                  : "Không tìm thấy bản ghi hình phù hợp với bộ lọc."}
              </div>
            ) : (
              <table className="w-full table-fixed min-w-[900px]">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[18%]" />
                  <col className="w-[14%]" />
                  <col className="w-[22%]" />
                  <col className="w-[16%]" />
                </colgroup>

                <thead className="bg-[#13263a] text-sm">
                  <tr className="text-slate-300">
                    <th className="p-5 text-left">Tên buổi phỏng vấn</th>
                    <th className="p-5 text-left">Meeting Code</th>
                    <th className="p-5 text-center">Thời lượng</th>
                    <th className="p-5 text-center">Thời gian</th>
                    <th className="p-5 text-center">Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedRecordings.map((item) => {
                    const code = meetingCodeFromCid(item.callCid);
                    return (
                      <tr
                        key={item.id}
                        className="border-t border-slate-800 hover:bg-cyan-500/5 transition duration-200"
                      >
                        <td
                          className="p-5 font-medium text-white truncate"
                          title={item.interviewTitle ?? ""}
                        >
                          {item.interviewTitle ? (
                            item.interviewTitle
                          ) : (
                            <span className="text-slate-500 italic text-xs">
                              —
                            </span>
                          )}
                        </td>
                        <td
                          className="p-5 font-medium text-white truncate"
                          title={code}
                        >
                          {code}
                        </td>
                        <td className="p-5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Clock3 size={14} />
                            {formatDuration(item.duration)}
                          </div>
                        </td>
                        <td className="p-5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <CalendarDays size={14} />
                            {formatDate(item.createdAt)}
                          </div>
                        </td>
                        <td className="p-5 text-center">
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
        {!isLoading && filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
            <p className="text-sm text-slate-400">
              Hiển thị{" "}
              <span className="font-semibold text-white">
                {pageStart + 1}–{Math.min(pageEnd, filtered.length)}
              </span>{" "}
              / {filtered.length} recordings
              <span className="text-slate-500 ml-2">
                (Tổng: {recordings.length})
              </span>
            </p>

            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={goToPage}
            />
          </div>
        )}
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
