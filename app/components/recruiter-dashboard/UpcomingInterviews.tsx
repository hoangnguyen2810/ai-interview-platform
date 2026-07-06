"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRecruiterDashboard } from "./DashboardContext";
import { useCountdown } from "@/hooks/useCountdown";
import {
  CreateInterviewModal,
  type CreatedInterview,
} from "./CreateInterviewModal";
import Link from "next/link";

type Interview = {
  id: string;
  title: string;
  description: string | null;
  meetingCode: string;
  scheduledAt: string;
  scheduledTime: string;
  maxInterviewers: string;
  maxParticipants: number;
  durationMinutes: number;
  allowGuest: boolean;
  enableRecording: boolean;
  status: "SCHEDULED" | "ONGOING" | "FINISHED";
  avatar: string;
};

const DEFAULT_AVATAR = "https://i.pravatar.cc/150";

function toCard(i: {
  id: string;
  title: string;
  description: string | null;
  meetingCode: string;
  scheduledAt: string;
  maxInterviewers: number;
  maxParticipants: number;
  durationMinutes: number;
  allowGuest: boolean;
  enableRecording: boolean;
  status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";
  avatar?: string | null;
}): Interview {
  const date = new Date(i.scheduledAt);
  const status: Interview["status"] =
    i.status === "ONGOING" || i.status === "FINISHED" ? i.status : "SCHEDULED";
  return {
    id: i.id,
    title: i.title,
    description: i.description ?? null,
    meetingCode: i.meetingCode,
    scheduledAt: i.scheduledAt,
    scheduledTime: date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    maxInterviewers: String(i.maxInterviewers),
    maxParticipants: i.maxParticipants ?? 10,
    durationMinutes: i.durationMinutes ?? 60,
    allowGuest: i.allowGuest ?? false,
    enableRecording: i.enableRecording ?? false,
    status,
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
function InterviewCard({
  interview,
  onShowDetail,
}: {
  interview: Interview;
  onShowDetail: (interview: Interview) => void;
}) {
  const router = useRouter();
  const countdown = useCountdown(interview.scheduledAt);

  const isStarted = new Date(interview.scheduledAt).getTime() <= Date.now();

  const status = isStarted ? "ONGOING" : "SCHEDULED";

  const handleEnter = () => {
    // ONGOING (đã tới giờ) → vào thẳng phòng.
    // SCHEDULED (chưa tới giờ) → mở modal chi tiết.
    if (status === "ONGOING") {
      router.push(
        `/interview/room/${encodeURIComponent(interview.meetingCode)}`,
      );
    } else {
      onShowDetail(interview);
    }
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
  const [detailInterview, setDetailInterview] =
    useState<CreatedInterview | null>(null);
  const { subscribeInterviewCreated, subscribeInterviewFinished } =
    useRecruiterDashboard();

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

  // Khi HOST bấm End Call → notification broadcast → re-fetch để
  // FINISHED tự động biến mất khỏi list này và hiện ở RecentInterviews.
  useEffect(() => {
    const unsubscribe = subscribeInterviewFinished(() => {
      fetchData();
    });
    return unsubscribe;
  }, [subscribeInterviewFinished, fetchData]);

  // Chỉ hiển thị các buổi CHƯA kết thúc (SCHEDULED/ONGOING).
  // FINISHED được UpcomingInterviews filter ra — sẽ hiện ở RecentInterviews.
  const handleShowDetail = useCallback((interview: Interview) => {
    // Map shape Interview (từ API /upcoming) → CreatedInterview (của modal).
    setDetailInterview({
      id: interview.id,
      title: interview.title,
      description: interview.description,
      meetingCode: interview.meetingCode,
      roomPassword: null, // API không trả password hash cho client
      allowGuest: interview.allowGuest,
      maxParticipants: interview.maxParticipants,
      maxInterviewers: interview.maxInterviewers === "3" ? 3 : 2,
      durationMinutes: (interview.durationMinutes as 30 | 60 | 90 | 120) || 60,
      status: interview.status,
      enableRecording: interview.enableRecording,
      scheduledAt: interview.scheduledAt,
      createdAt: interview.scheduledAt,
      avatarUrl: interview.avatar,
    });
  }, []);

  const visibleInterviews = useMemo(
    () => interviews.filter((i) => i.status !== "FINISHED").slice(0, 2),
    [interviews],
  );

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
        <Link
          href="/recruiter/interviews"
          className="text-black bg-cyan-400 px-3 py-1 rounded-md text-sm font-medium transition hover:bg-cyan-300 hover:shadow-lg hover:cyan-400/30"
        >
          Xem tất cả
        </Link>
      </div>

      {visibleInterviews.length === 0 ? (
        <div className="glass-card p-6 rounded-2xl text-sm text-on-surface-variant text-center">
          Hôm nay không còn buổi phỏng vấn nào đang chờ.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleInterviews.map((interview) => (
            <InterviewCard
              key={interview.id}
              interview={interview}
              onShowDetail={handleShowDetail}
            />
          ))}
        </div>
      )}

      <CreateInterviewModal
        mode="detail"
        open={detailInterview !== null}
        detailInterview={detailInterview}
        onClose={() => setDetailInterview(null)}
      />
    </div>
  );
}
