"use client";

import { SideNavBar } from "@/app/components/SideNavBar";
import { TopNavBar } from "@/app/components/TopNavBar";
import { CreateInterviewModal } from "@/app/components/recruiter-dashboard/CreateInterviewModal";
import { Pagination } from "@/app/components/Pagination";
import { useRecruiterDashboard } from "@/app/components/recruiter-dashboard/DashboardContext";
import {
  MoreHorizontal,
  Plus,
  Search,
  Users,
  CalendarDays,
  Clock3,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

function formatDateTime(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (isNaN(date.getTime())) return value;

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

type InterviewStatus = "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";

type InterviewItem = {
  id: string;
  title: string;
  code: string;
  status: InterviewStatus;
  duration: number;
  time: string;
  interviewers: number;
  scheduledAt: string;
};

type Stats = {
  total: number;
  scheduled: number;
  ongoing: number;
  finished: number;
};

const PAGE_SIZE = 5;

const STATUS_OPTIONS: { value: InterviewStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tất cả trạng thái" },
  { value: "SCHEDULED", label: "Đã lên lịch" },
  { value: "ONGOING", label: "Đang diễn ra" },
  { value: "FINISHED", label: "Hoàn thành" },
  { value: "CANCELLED", label: "Đã hủy" },
];

const DURATION_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Thời lượng" },
  { value: "30", label: "30 phút" },
  { value: "60", label: "60 phút" },
  { value: "90", label: "90 phút" },
  { value: "120", label: "120 phút" },
];

const getStatusColor = (status: InterviewStatus) => {
  switch (status) {
    case "SCHEDULED":
      return "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30";
    case "ONGOING":
      return "bg-green-500/15 text-green-400 border border-green-500/30";
    case "FINISHED":
      return "bg-slate-500/15 text-slate-300 border border-slate-500/30";
    case "CANCELLED":
      return "bg-red-500/15 text-red-400 border border-red-500/30";
    default:
      return "bg-slate-500/15 text-slate-300 border border-slate-500/30";
  }
};

const getStatusLabel = (status: InterviewStatus) => {
  switch (status) {
    case "SCHEDULED":
      return "Đã lên lịch";
    case "ONGOING":
      return "Đang diễn ra";
    case "FINISHED":
      return "Hoàn thành";
    case "CANCELLED":
      return "Đã hủy";
    default:
      return status;
  }
};

export default function InterviewManagementPage() {
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    scheduled: 0,
    ongoing: 0,
    finished: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InterviewStatus | "ALL">(
    "ALL",
  );
  const [durationFilter, setDurationFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const {
    subscribeInterviewCreated,
    subscribeInterviewFinished,
    notifyInterviewCreated,
    notifyInterviewFinished,
  } = useRecruiterDashboard();

  // Debounce search input (300ms)
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("token")
          : null;
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url = new URL("/api/interviews", window.location.origin);
      if (statusFilter !== "ALL") {
        url.searchParams.set("status", statusFilter);
      }
      if (debouncedSearch) {
        url.searchParams.set("search", debouncedSearch);
      }
      if (durationFilter !== "all") {
        url.searchParams.set("duration", durationFilter);
      }
      url.searchParams.set("limit", "100");

      const res = await fetch(url.toString(), {
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);

      const json = await res.json();
      setInterviews(Array.isArray(json.interviews) ? json.interviews : []);
      if (json.stats) setStats(json.stats);
    } catch (err) {
      console.error("[interviews page] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, durationFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Mỗi khi filter/search thay đổi → reset về page 1
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, debouncedSearch, durationFilter]);

  // Refresh khi có interview mới tạo
  useEffect(() => {
    return subscribeInterviewCreated(() => {
      fetchData();
    });
  }, [subscribeInterviewCreated, fetchData]);

  // Refresh khi HOST bấm End Call
  useEffect(() => {
    return subscribeInterviewFinished(() => {
      fetchData();
    });
  }, [subscribeInterviewFinished, fetchData]);

  // Bridge window event từ FooterControls → DashboardContext
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

  const totalLabel = useMemo(() => {
    if (stats.total === 0) return "0";
    return stats.total.toLocaleString("vi-VN");
  }, [stats.total]);

  // ============== Pagination ==============
  const totalPages = Math.max(1, Math.ceil(interviews.length / PAGE_SIZE));

  // Nếu currentPage vượt quá totalPages (vd. data shrink sau khi xóa/finish),
  // tự động kéo về trang cuối cùng hợp lệ.
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const paginatedInterviews = useMemo(
    () => interviews.slice(pageStart, pageEnd),
    [interviews, pageStart, pageEnd],
  );

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      <TopNavBar />
      <SideNavBar />

      <main className="ml-sidebar-width pt-20 px-10 pb-10 min-h-screen bg-[#071524] text-white overflow-x-auto custom-scrollbar">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight">
              Quản lý phỏng vấn
            </h1>
            <p className="text-slate-400 mt-2 leading-relaxed">
              Quản lý lịch trình, phòng phỏng vấn và trạng thái buổi phỏng vấn
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold transition shadow-lg shadow-cyan-500/20"
          >
            <Plus size={18} />
            Tạo buổi phỏng vấn
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
          <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-6 hover:-translate-y-1 transition shadow-md shadow-black/20">
            <div className="flex justify-between items-center">
              <p className="text-slate-400 text-sm">Tổng buổi phỏng vấn</p>
              <Users size={20} className="text-cyan-400" />
            </div>
            <h2 className="text-4xl font-bold mt-4">{totalLabel}</h2>
          </div>

          <div className="bg-[#0F1E2E] border border-yellow-500/10 rounded-2xl p-6 hover:-translate-y-1 transition shadow-md shadow-black/20">
            <div className="flex justify-between items-center">
              <p className="text-slate-400 text-sm">Đã lên lịch</p>
              <CalendarDays size={20} className="text-yellow-400" />
            </div>
            <h2 className="text-4xl font-bold text-yellow-400 mt-4">
              {stats.scheduled.toLocaleString("vi-VN")}
            </h2>
          </div>

          <div className="bg-[#0F1E2E] border border-green-500/10 rounded-2xl p-6 hover:-translate-y-1 transition shadow-md shadow-black/20">
            <div className="flex justify-between items-center">
              <p className="text-slate-400 text-sm">Đang diễn ra</p>
              <Clock3 size={20} className="text-green-400" />
            </div>
            <h2 className="text-4xl font-bold text-green-400 mt-4">
              {stats.ongoing.toLocaleString("vi-VN")}
            </h2>
          </div>

          <div className="bg-[#0F1E2E] border border-slate-500/10 rounded-2xl p-6 hover:-translate-y-1 transition shadow-md shadow-black/20">
            <div className="flex justify-between items-center">
              <p className="text-slate-400 text-sm">Hoàn thành</p>
              <CheckCircle2 size={20} className="text-slate-300" />
            </div>
            <h2 className="text-4xl font-bold text-slate-300 mt-4">
              {stats.finished.toLocaleString("vi-VN")}
            </h2>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-6 mb-10">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm buổi phỏng vấn (tiêu đề / mã phòng)..."
                className="w-full bg-[#071524] border border-slate-700 rounded-xl pl-11 pr-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as InterviewStatus | "ALL")
              }
              className="bg-[#071524] border border-slate-700 rounded-xl px-4 py-3 min-w-[160px] outline-none focus:border-cyan-500 transition"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={durationFilter}
              onChange={(e) => setDurationFilter(e.target.value)}
              className="bg-[#071524] border border-slate-700 rounded-xl px-4 py-3 min-w-[160px] outline-none focus:border-cyan-500 transition"
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TABLE */}
        {/* table-fixed + width % cố định cho từng cột để header và data luôn
            canh thẳng hàng với nhau, không bị lệch theo độ dài nội dung */}
        <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl overflow-hidden shadow-lg shadow-black/20">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full table-fixed min-w-[860px]">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[13%]" />
                <col className="w-[19%]" />
                <col className="w-[10%]" />
              </colgroup>

              <thead className="bg-[#13263a] text-sm">
                <tr className="text-slate-300">
                  <th className="p-5 text-left">Tiêu đề</th>
                  <th className="p-5 text-left">Mã phòng</th>
                  <th className="p-5 text-center">Trạng thái</th>
                  <th className="p-5 text-center">Thời lượng</th>
                  <th className="p-5 text-center">Thời gian</th>
                  <th className="p-5 text-center">Thao tác</th>
                </tr>
              </thead>

              <tbody className="text-sm">
                {loading && interviews.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">
                      <Loader2 className="inline-block animate-spin mr-2" />
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : interviews.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">
                      Chưa có buổi phỏng vấn nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  paginatedInterviews.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-slate-800 hover:bg-cyan-500/5 transition"
                    >
                      <td
                        className="p-5 font-medium truncate"
                        title={item.title}
                      >
                        {item.title}
                      </td>
                      <td
                        className="p-5 text-cyan-400 font-medium truncate"
                        title={item.code}
                      >
                        {item.code}
                      </td>

                      <td className="p-5 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                            item.status,
                          )}`}
                        >
                          {getStatusLabel(item.status)}
                        </span>
                      </td>

                      <td className="p-5 text-center">{item.duration} phút</td>
                      <td className="p-5 text-center whitespace-nowrap">
                        {formatDateTime(item.scheduledAt)}
                      </td>

                      <td className="p-5">
                        <div className="flex justify-center">
                          <button className="p-2 rounded-lg hover:bg-slate-700 transition">
                            <MoreHorizontal size={18} />
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

        {/* Footer count + Pagination */}
        {!loading && interviews.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
            <p className="text-sm text-slate-400">
              Hiển thị{" "}
              <span className="font-semibold text-white">
                {pageStart + 1}–{Math.min(pageEnd, interviews.length)}
              </span>{" "}
              / {interviews.length} buổi
              <span className="text-slate-500 ml-2">
                (Tổng: {stats.total.toLocaleString("vi-VN")})
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

      <CreateInterviewModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(interview) => {
          // Báo cho dashboard đang mở ở tab khác (Upcoming/Recent) refresh
          notifyInterviewCreated(interview);
          // Tự refresh list ngay
          fetchData();
        }}
      />
    </>
  );
}
