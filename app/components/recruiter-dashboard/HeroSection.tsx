"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreateInterviewModal } from "./CreateInterviewModal";
import { useRecruiterDashboard } from "./DashboardContext";

type MeResponse = {
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    role: string;
  } | null;
};

type ApiStats = {
  total: number;
  scheduled: number;
  ongoing: number;
  finished: number;
  thisMonth: number;
  today: number;
};

/**
 * Trả về lời chào theo giờ Việt Nam (UTC+7).
 * - 05:00 – 11:00 → "Chào buổi sáng"
 * - 11:00 – 13:00 → "Chào buổi trưa"
 * - 13:00 – 18:00 → "Chào buổi chiều"
 * - 18:00 – 22:00 → "Chào buổi tối"
 * - còn lại       → "Chúc bạn ngủ ngon" (hiếm gặp vì dashboard ít active)
 */
function getGreeting(date: Date): string {
  const vnHour = Number(
    new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(date),
  );

  if (vnHour >= 5 && vnHour < 11) return "Chào buổi sáng";
  if (vnHour >= 11 && vnHour < 13) return "Chào buổi trưa";
  if (vnHour >= 13 && vnHour < 18) return "Chào buổi chiều";
  if (vnHour >= 18 && vnHour < 22) return "Chào buổi tối";
  return "Chào";
}

/**
 * Lấy first name từ fullName để gọi thân mật hơn.
 * "Nguyễn Văn Quân" → "Quân"
 * "Quân"             → "Quân"
 */
function getFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 0 ? parts[parts.length - 1] : fullName;
}

/**
 * Render câu chào phù hợp theo `today` count từ API.
 * - 0 buổi  → "Hôm nay bạn chưa có lịch phỏng vấn nào…"
 * - 1 buổi  → "Hôm nay có 1 buổi phỏng vấn đang chờ…"
 * - N buổi  → "Hôm nay có N buổi phỏng vấn đang chờ…"
 */
function buildSubtitle(
  todayCount: number | null,
  fullName: string | null,
): string {
  const tail = "Chúc bạn một ngày làm việc hiệu quả!";
  if (todayCount === null) {
    return "Hệ thống AI của bạn đã sẵn sàng cho hôm nay. " + tail;
  }
  if (todayCount === 0) {
    return `Hôm nay ${fullName ?? "bạn"} chưa có lịch phỏng vấn nào. ${tail}`;
  }
  const noun = todayCount === 1 ? "buổi phỏng vấn" : "buổi phỏng vấn";
  return `Hôm nay ${fullName ?? "bạn"} có ${todayCount} ${noun} đang chờ. ${tail}`;
}

export function HeroSection() {
  const [open, setOpen] = useState(false);
  const {
    notifyInterviewCreated,
    subscribeInterviewCreated,
    subscribeInterviewFinished,
  } = useRecruiterDashboard();

  const [fullName, setFullName] = useState<string | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---- Lấy tên user hiện tại ---- */
  const fetchMe = useCallback(async () => {
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("token")
          : null;
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/auth/me", {
        headers,
        credentials: "include",
      });
      if (!res.ok) return;
      const json = (await res.json()) as MeResponse;
      if (json?.user?.fullName) {
        setFullName(json.user.fullName);
      }
    } catch (err) {
      console.error("[hero] fetch /api/auth/me error:", err);
    }
  }, []);

  /* ---- Lấy stats.today ---- */
  const fetchStats = useCallback(async () => {
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("token")
          : null;
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // limit=1 để body ngắn — chỉ lấy stats.
      const res = await fetch("/api/interviews?limit=1", {
        headers,
        credentials: "include",
      });
      if (!res.ok) return;

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) return;

      const json = await res.json();
      if (json?.stats && typeof json.stats.today === "number") {
        setTodayCount(json.stats.today);
      }
    } catch (err) {
      console.error("[hero] fetch /api/interviews error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
    fetchStats();
  }, [fetchMe, fetchStats]);

  /* ---- Đồng bộ realtime ---- */
  useEffect(() => {
    return subscribeInterviewCreated(() => {
      fetchStats();
    });
  }, [subscribeInterviewCreated, fetchStats]);

  useEffect(() => {
    return subscribeInterviewFinished(() => {
      fetchStats();
    });
  }, [subscribeInterviewFinished, fetchStats]);

  const greeting = useMemo(() => getGreeting(new Date()), []);
  const firstName = useMemo(
    () => (fullName ? getFirstName(fullName) : null),
    [fullName],
  );
  const subtitle = useMemo(
    () => buildSubtitle(todayCount, firstName),
    [todayCount, firstName],
  );

  return (
    <>
      <section className="relative mb-10 p-8 rounded-3xl overflow-hidden glass-card">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="font-headline-xl text-headline-xl mb-2">
              {greeting}
              {firstName ? (
                <>, {firstName}!</>
              ) : loading ? (
                <span className="inline-block w-24 h-9 align-middle rounded-md bg-surface-container-high animate-pulse ml-1" />
              ) : (
                "!"
              )}
            </h1>

            <p className="text-on-surface-variant max-w-lg">
              {loading && todayCount === null ? (
                <span className="inline-block w-full max-w-lg h-5 rounded bg-surface-container-high animate-pulse" />
              ) : (
                subtitle
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-primary-container text-on-primary-fixed font-bold px-8 py-4 rounded-xl hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all flex items-center gap-2 group"
          >
            <span className="material-symbols-outlined group-hover:rotate-90 transition-transform">
              add
            </span>
            Tạo buổi phỏng vấn mới
          </button>
        </div>
      </section>

      <CreateInterviewModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={notifyInterviewCreated}
      />
    </>
  );
}
