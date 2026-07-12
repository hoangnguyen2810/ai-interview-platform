"use client";

// Lịch sử tham gia phỏng vấn cho candidate — load từ /api/candidate/interviews.
//
// Hiển thị:
//   - Title buổi phỏng vấn (từ interviews.title)
//   - Mã phòng (meeting_code)
//   - Thời gian scheduled
//   - Trạng thái: UPCOMING (scheduled), ONGOING, FINISHED, CANCELLED
//   - Badge "Có recording" nếu recordings.exists cho meeting_code
//
// Empty state: "Bạn chưa tham gia buổi phỏng vấn nào".

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface InterviewHistoryItem {
  interviewId: string;
  meetingCode: string;
  title: string;
  status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";
  firstJoinedAt: string;
  lastLeftAt: string | null;
  visitCount: number;
  hasRecording: boolean;
}

interface ApiResponse {
  success: boolean;
  interviews?: InterviewHistoryItem[];
  total?: number;
  message?: string;
}

type StatusFilter = "ALL" | "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "Tất cả trạng thái" },
  { key: "SCHEDULED", label: "Sắp tới" },
  { key: "ONGOING", label: "Đang diễn ra" },
  { key: "FINISHED", label: "Đã kết thúc" },
  { key: "CANCELLED", label: "Đã hủy" },
];

const STATUS_BADGE: Record<
  InterviewHistoryItem["status"],
  { className: string; label: string }
> = {
  SCHEDULED: {
    className: "bg-purple-500/10 text-purple-300",
    label: "Sắp tới",
  },
  ONGOING: {
    className: "bg-cyan-500/10 text-cyan-300",
    label: "Đang diễn ra",
  },
  FINISHED: {
    className: "bg-emerald-500/10 text-emerald-300",
    label: "Đã hoàn thành",
  },
  CANCELLED: {
    className: "bg-red-500/10 text-red-300",
    label: "Đã hủy",
  },
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // dd/MM/yyyy HH:mm — local time
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

export function InterviewHistoryList() {
  const [items, setItems] = useState<InterviewHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async (status: StatusFilter) => {
    setIsLoading(true);
    setError(null);
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("token")
          : null;
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const qs =
        status === "ALL"
          ? "?limit=50"
          : `?status=${status}&limit=50`;
      const res = await fetch(`/api/candidate/interviews${qs}`, {
        headers,
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as ApiResponse | null;

      if (!res.ok || !json?.success) {
        throw new Error(json?.message ?? `HTTP ${res.status}`);
      }
      setItems(json.interviews ?? []);
    } catch (err) {
      console.error("[history] load failed:", err);
      setError(err instanceof Error ? err.message : "Không tải được lịch sử");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const activeFilterLabel =
    FILTERS.find((f) => f.key === filter)?.label ?? "Tất cả trạng thái";

  return (
    <section className="space-y-4">
      {/* HEADER + FILTER */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Lịch sử phỏng vấn</h2>

        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="flex items-center bg-[#1c2b3c] px-4 py-2 rounded-lg border border-[#3b494b] hover:bg-[#233448] transition"
          >
            <span className="material-symbols-outlined text-sm mr-2">
              filter_list
            </span>
            <span className="text-sm">{activeFilterLabel}</span>
            <span className="material-symbols-outlined text-sm ml-2">
              {filterOpen ? "expand_less" : "expand_more"}
            </span>
          </button>

          {filterOpen && (
            <div
              className="absolute right-0 mt-2 w-48 bg-[#0d1c2d] border border-[#3b494b] rounded-lg shadow-xl overflow-hidden z-10"
              onMouseLeave={() => setFilterOpen(false)}
            >
              {FILTERS.map((f) => {
                const active = f.key === filter;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      setFilter(f.key);
                      setFilterOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition ${
                      active
                        ? "bg-cyan-500/10 text-cyan-300"
                        : "text-gray-300 hover:bg-[#1c2b3c]"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* LIST */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="glass-panel p-5 rounded-2xl animate-pulse h-20"
            />
          ))}
        </div>
      ) : error ? (
        <div className="glass-panel p-6 rounded-2xl border border-red-500/30 text-red-300">
          <p className="font-semibold">Không tải được lịch sử</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel p-8 rounded-2xl text-center space-y-2">
          <span className="material-symbols-outlined text-5xl text-gray-500">
            history
          </span>
          <p className="text-gray-400">
            Bạn chưa tham gia buổi phỏng vấn nào
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const badge = STATUS_BADGE[it.status];
            return (
              <div
                key={it.interviewId}
                className="glass-panel p-5 rounded-2xl flex items-center gap-6 hover:bg-[#1c2b3c] transition"
              >
                {/* ICON */}
                <div className="w-14 h-14 bg-[#1c2b3c] rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-cyan-300">
                    videocam
                  </span>
                </div>

                {/* INFO */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-bold truncate">{it.title}</h4>
                  <p className="text-sm text-gray-400">
                    Mã phòng: {it.meetingCode}
                    {it.firstJoinedAt
                      ? ` • Vào lúc ${formatDateTime(it.firstJoinedAt)}`
                      : ""}
                  </p>
                  {it.visitCount > 1 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Đã tham gia {it.visitCount} lượt
                      {it.lastLeftAt
                        ? ` • Kết thúc lúc ${formatDateTime(it.lastLeftAt)}`
                        : " • Đang trong phòng"}
                    </p>
                  )}
                  {it.visitCount === 1 && it.lastLeftAt && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Rời phòng lúc {formatDateTime(it.lastLeftAt)}
                    </p>
                  )}
                </div>

                {/* BADGES */}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 text-sm rounded-full font-bold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  {it.hasRecording && (
                    <span className="px-2 py-1 text-xs rounded-full bg-amber-500/10 text-amber-300 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">
                        movie
                      </span>
                      Có recording
                    </span>
                  )}
                </div>

                {/* ACTION */}
                {(it.status === "SCHEDULED" || it.status === "ONGOING") && (
                  <Link
                    href={`/interview/room/${encodeURIComponent(it.meetingCode)}`}
                    className="ml-2 px-3 py-1 text-sm rounded-lg bg-cyan-500/10 text-cyan-300 font-bold hover:bg-cyan-500/20 transition"
                  >
                    Vào phòng
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}