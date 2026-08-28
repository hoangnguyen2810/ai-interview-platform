"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useRecruiterDashboard } from "./DashboardContext";

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
  status: "FINISHED";
  avatar: string;
};

export function RecentInterviews() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { subscribeInterviewFinished, subscribeInterviewCreated } =
    useRecruiterDashboard();

  const fetchData = useCallback(async () => {
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("token")
          : null;
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/interviews/upcoming", { headers });
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Response không phải JSON");
      }

      const data: Interview[] = await res.json();
      setInterviews(data.filter((i) => i.status === "FINISHED"));
    } catch (err) {
      console.error("[recent-interviews] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh khi có interview mới tạo (để đảm bảo data mới nhất)
  useEffect(() => {
    return subscribeInterviewCreated(() => {
      fetchData();
    });
  }, [subscribeInterviewCreated, fetchData]);

  // Khi HOST bấm End Call → InterviewRoom notify → refresh list
  useEffect(() => {
    return subscribeInterviewFinished(() => {
      fetchData();
    });
  }, [subscribeInterviewFinished, fetchData]);

  /**
   * Bridge từ window CustomEvent (phát ra từ FooterControls khi HOST end call)
   * sang DashboardContext để các component cùng dashboard (như UpcomingInterviews)
   * cũng refresh khi user mở tab này ở background.
   */
  const { notifyInterviewFinished } = useRecruiterDashboard();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ meetingCode: string }>).detail;
      if (detail?.meetingCode) {
        notifyInterviewFinished(detail.meetingCode);
      }
    };
    window.addEventListener("neuralcode:interview-finished", handler);
    return () => {
      window.removeEventListener("neuralcode:interview-finished", handler);
    };
  }, [notifyInterviewFinished]);

  const handleAction = useCallback(
    (meetingCode: string) => {
      // Vào trang recordings để xem lại buổi đã kết thúc
      router.push(
        `/recruiter/recordings?meetingCode=${encodeURIComponent(meetingCode)}`,
      );
    },
    [router],
  );

  const visible = useMemo(() => {
    return [...interviews]
      .sort(
        (a, b) =>
          new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
      )
      .slice(0, 4);
  }, [interviews]);

  return (
    <div className="pt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-headline-lg text-headline-lg">Phỏng vấn gần đây</h2>

        <button
          type="button"
          onClick={() => router.push("/recruiter/interviews")}
          className="text-sm font-medium text-primary-fixed hover:opacity-80 transition cursor-pointer"
        >
          Xem tất cả
        </button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-outline-variant">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-container-high border-b border-outline-variant">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Vị trí
              </th>

              <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Phòng
              </th>

              <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Thời gian
              </th>

              <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Trạng thái
              </th>

              <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Hành động
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-10 text-center text-sm text-on-surface-variant"
                >
                  Đang tải...
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-10 text-center text-sm text-on-surface-variant"
                >
                  Hôm nay chưa có buổi phỏng vấn nào kết thúc.
                </td>
              </tr>
            ) : (
              visible.map((interview) => (
                <tr
                  key={interview.id}
                  className="border-b border-outline-variant/50 hover:bg-surface-container-high transition-all duration-200"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-primary-fixed/10 flex items-center justify-center">
                        <img
                          src={interview.avatar}
                          alt={interview.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div>
                        <p className="font-semibold text-on-surface">
                          {interview.title}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {interview.meetingCode}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-5 text-center">
                    <span className="font-code text-sm">
                      {interview.meetingCode}
                    </span>
                  </td>

                  <td className="px-6 py-5 text-center">
                    <span className="font-medium text-sm">
                      {interview.scheduledTime}
                    </span>
                  </td>

                  <td className="px-6 py-5 text-center">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border bg-secondary/20 text-secondary border-secondary/30">
                      Hoàn thành
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleAction(interview.meetingCode)}
                        title="Xem recordings"
                        className="w-9 h-9 rounded-full bg-surface-container-high hover:bg-primary-fixed/10 flex items-center justify-center transition"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          visibility
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
