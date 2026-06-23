"use client";

import { SideNavBar } from "@/app/components/SideNavBar";
import { TopNavBar } from "@/app/components/TopNavBar";
import {
  MoreHorizontal,
  Plus,
  Search,
  Users,
  CalendarDays,
  Clock3,
  CheckCircle2,
} from "lucide-react";

const interviews = [
  {
    id: 1,
    title: "Frontend Developer Interview",
    code: "FE001",
    status: "SCHEDULED",
    duration: 60,
    time: "23 Jun 2026 - 14:00",
    interviewers: 2,
  },
  {
    id: 2,
    title: "Backend Developer Interview",
    code: "BE002",
    status: "ONGOING",
    duration: 90,
    time: "23 Jun 2026 - 15:00",
    interviewers: 3,
  },
  {
    id: 3,
    title: "UI/UX Designer Interview",
    code: "UX003",
    status: "FINISHED",
    duration: 60,
    time: "22 Jun 2026 - 10:00",
    interviewers: 2,
  },
];

const getStatusColor = (status: string) => {
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

const getStatusLabel = (status: string) => {
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
  return (
    <>
      <TopNavBar />
      <SideNavBar />

      <main className="ml-sidebar-width pt-20 px-10 pb-10 min-h-screen bg-[#071524] text-white">
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

          <button className="shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold transition shadow-lg shadow-cyan-500/20">
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
            <h2 className="text-4xl font-bold mt-4">24</h2>
          </div>

          <div className="bg-[#0F1E2E] border border-yellow-500/10 rounded-2xl p-6 hover:-translate-y-1 transition shadow-md shadow-black/20">
            <div className="flex justify-between items-center">
              <p className="text-slate-400 text-sm">Đã lên lịch</p>
              <CalendarDays size={20} className="text-yellow-400" />
            </div>
            <h2 className="text-4xl font-bold text-yellow-400 mt-4">10</h2>
          </div>

          <div className="bg-[#0F1E2E] border border-green-500/10 rounded-2xl p-6 hover:-translate-y-1 transition shadow-md shadow-black/20">
            <div className="flex justify-between items-center">
              <p className="text-slate-400 text-sm">Đang diễn ra</p>
              <Clock3 size={20} className="text-green-400" />
            </div>
            <h2 className="text-4xl font-bold text-green-400 mt-4">2</h2>
          </div>

          <div className="bg-[#0F1E2E] border border-slate-500/10 rounded-2xl p-6 hover:-translate-y-1 transition shadow-md shadow-black/20">
            <div className="flex justify-between items-center">
              <p className="text-slate-400 text-sm">Hoàn thành</p>
              <CheckCircle2 size={20} className="text-slate-300" />
            </div>
            <h2 className="text-4xl font-bold text-slate-300 mt-4">11</h2>
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
                placeholder="Tìm kiếm buổi phỏng vấn..."
                className="w-full bg-[#071524] border border-slate-700 rounded-xl pl-11 pr-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition"
              />
            </div>

            <select className="bg-[#071524] border border-slate-700 rounded-xl px-4 py-3 min-w-[160px]">
              <option>Tất cả trạng thái</option>
              <option>Đã lên lịch</option>
              <option>Đang diễn ra</option>
              <option>Hoàn thành</option>
              <option>Đã hủy</option>
            </select>

            <select className="bg-[#071524] border border-slate-700 rounded-xl px-4 py-3 min-w-[160px]">
              <option>Thời lượng</option>
              <option>30 phút</option>
              <option>60 phút</option>
              <option>90 phút</option>
              <option>120 phút</option>
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl overflow-hidden shadow-lg shadow-black/20">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#13263a] text-sm">
                <tr className="text-left text-slate-300">
                  <th className="p-5">Tiêu đề</th>
                  <th className="p-5">Mã phòng</th>
                  <th className="p-5">Trạng thái</th>
                  <th className="p-5">Thời lượng</th>
                  <th className="p-5">Thời gian</th>
                  <th className="p-5 text-center">Thao tác</th>
                </tr>
              </thead>

              <tbody className="text-sm">
                {interviews.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-slate-800 hover:bg-cyan-500/5 transition"
                  >
                    <td className="p-5 font-medium">{item.title}</td>
                    <td className="p-5 text-cyan-400 font-medium">
                      {item.code}
                    </td>

                    <td className="p-5">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          item.status,
                        )}`}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </td>

                    <td className="p-5">{item.duration} phút</td>
                    <td className="p-5">{item.time}</td>

                    <td className="p-5">
                      <div className="flex justify-center">
                        <button className="p-2 rounded-lg hover:bg-slate-700 transition">
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
