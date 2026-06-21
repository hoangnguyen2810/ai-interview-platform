"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useRecruiterDashboard } from "./DashboardContext";
import { useCountdown } from "@/hooks/useCountdown";

type Interview = {
  id: string;
  title: string;
  meetingCode: string;
  scheduledAt: string;
  scheduledTime: string;
  maxInterviewers: string;
  status: "SCHEDULED" | "ONGOING";
  avatar: string;
};

const DEFAULT_AVATAR = "https://i.pravatar.cc/150";

function toCard(i: {
  id: string;
  title: string;
  meetingCode: string;
  scheduledAt: string;
  maxInterviewers: number;
  status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";
  avatar?: string | null;
}): Interview {
  const date = new Date(i.scheduledAt);
  return {
    id: i.id,
    title: i.title,
    meetingCode: i.meetingCode,
    scheduledAt: i.scheduledAt,
    scheduledTime: date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    maxInterviewers: String(i.maxInterviewers),
    status: i.status === "ONGOING" ? "ONGOING" : "SCHEDULED",
    avatar: i.avatar && i.avatar.trim() !== "" ? i.avatar : DEFAULT_AVATAR,
  };
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();

  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/* ================= CARD ================= */
function InterviewCard({ interview }: { interview: Interview }) {
  const router = useRouter();
  const countdown = useCountdown(interview.scheduledAt);

  const isStarted = new Date(interview.scheduledAt).getTime() <= Date.now();

  const status = isStarted ? "ONGOING" : "SCHEDULED";

  const handleEnter = () => {
    router.push(`/interview/room/${encodeURIComponent(interview.meetingCode)}`);
  };

  return (
    <div className="glass-card p-5 rounded-2xl grid grid-cols-[1fr_140px_140px] items-center gap-6 hover:bg-surface-container-high transition-all">
      {/* LEFT */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-12 h-12 rounded-full overflow-hidden border border-outline-variant flex-shrink-0">
          <img
            src={interview.avatar}
            alt="avatar"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="min-w-0">
          <h4 className="font-bold text-on-surface truncate">
            {interview.title}
          </h4>

          <p className="text-sm text-on-surface-variant truncate">
            Room: {interview.meetingCode}
          </p>

          <p className="text-xs text-on-surface-variant">
            {interview.maxInterviewers} HR
          </p>
        </div>
      </div>

      {/* CENTER */}
      <div className="flex flex-col items-center">
        <span className="font-code-md text-code-md">
          {interview.scheduledTime}
        </span>

        <span
          className={`text-[10px] uppercase tracking-widest mt-1 ${
            status === "ONGOING" ? "text-green-400" : "text-yellow-400"
          }`}
        >
          {status === "ONGOING" ? "Đang diễn ra" : `Còn ${countdown}`}
        </span>
      </div>

      {/* RIGHT */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleEnter}
          className={
            status === "ONGOING"
              ? "w-[120px] bg-primary-fixed cursor-pointer text-on-primary-fixed py-3 rounded-lg font-bold text-sm"
              : "w-[120px] border border-outline-variant cursor-pointer text-on-surface py-3 rounded-lg font-bold text-sm"
          }
        >
          {status === "ONGOING" ? "Vào phòng" : "Chi tiết"}
        </button>
      </div>
    </div>
  );
}

/* ================= MAIN ================= */
export function UpcomingInterviews() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const { subscribeInterviewCreated } = useRecruiterDashboard();

  const fetchData = useCallback(async () => {
    try {
      const token = window.localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/interviews/upcoming", { headers });
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Response không phải JSON");
      }

      const data: Interview[] = await res.json();
      setInterviews(data);
    } catch (err) {
      console.error("fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const unsubscribe = subscribeInterviewCreated((interview) => {
      if (isToday(interview.scheduledAt)) {
        const card = toCard(interview);

        setInterviews((prev) => {
          if (prev.some((p) => p.id === card.id)) return prev;
          return [card, ...prev];
        });
      }

      fetchData();
    });

    return unsubscribe;
  }, [subscribeInterviewCreated, fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="font-headline-lg text-headline-lg">
          Lịch phỏng vấn hôm nay
        </h2>
        <div className="text-sm text-on-surface-variant">
          Đang tải dữ liệu...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-headline-lg text-headline-lg">
          Lịch phỏng vấn hôm nay
        </h2>
        <span className="text-primary-fixed text-sm font-label-sm underline cursor-pointer">
          Xem tất cả
        </span>
      </div>

      {interviews.length === 0 ? (
        <div className="glass-card p-6 rounded-2xl text-sm text-on-surface-variant text-center">
          Hôm nay chưa có buổi phỏng vấn nào.
        </div>
      ) : (
        <div className="space-y-4">
          {interviews.map((interview) => (
            <InterviewCard key={interview.id} interview={interview} />
          ))}
        </div>
      )}
    </div>
  );
}
