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
} from "lucide-react";

const recordings = [
  {
    id: 1,
    title: "Frontend Interview Recording",
    code: "REC001",
    duration: 62,
    date: "23 Jun 2026 - 14:00",
    size: "120 MB",
    status: "AVAILABLE",
  },
  {
    id: 2,
    title: "Backend Interview Recording",
    code: "REC002",
    duration: 95,
    date: "23 Jun 2026 - 15:00",
    size: "210 MB",
    status: "PROCESSING",
  },
  {
    id: 3,
    title: "UI/UX Interview Recording",
    code: "REC003",
    duration: 58,
    date: "22 Jun 2026 - 10:00",
    size: "98 MB",
    status: "AVAILABLE",
  },
];

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

export default function RecordingsPage() {
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-6">
            <p className="text-slate-400 text-sm">Tổng recordings</p>
            <h2 className="text-4xl font-bold mt-3">18</h2>
          </div>

          <div className="bg-[#0F1E2E] border border-green-500/10 rounded-2xl p-6">
            <p className="text-slate-400 text-sm">Sẵn sàng</p>
            <h2 className="text-4xl font-bold text-green-400 mt-3">14</h2>
          </div>

          <div className="bg-[#0F1E2E] border border-yellow-500/10 rounded-2xl p-6">
            <p className="text-slate-400 text-sm">Đang xử lý</p>
            <h2 className="text-4xl font-bold text-yellow-400 mt-3">4</h2>
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
                className="w-full bg-[#071524] border border-slate-700 rounded-xl pl-11 pr-4 py-3 outline-none focus:border-cyan-500"
              />
            </div>

            <select className="bg-[#071524] border border-slate-700 rounded-xl px-4 py-3 min-w-[160px]">
              <option>Tất cả trạng thái</option>
              <option>Sẵn sàng</option>
              <option>Đang xử lý</option>
              <option>Thất bại</option>
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
                  <th className="p-5">Mã</th>
                  <th className="p-5">Thời lượng</th>
                  <th className="p-5">Dung lượng</th>
                  <th className="p-5">Thời gian</th>
                  <th className="p-5 text-center">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {recordings.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-slate-800 hover:bg-cyan-500/5 transition"
                  >
                    <td className="p-5 font-medium flex items-center gap-2">
                      <PlayCircle size={16} className="text-cyan-400" />
                      {item.title}
                    </td>

                    <td className="p-5 text-cyan-400 font-medium">
                      {item.code}
                    </td>

                    <td className="p-5 flex items-center gap-1">
                      <Clock3 size={14} />
                      {item.duration} phút
                    </td>

                    <td className="p-5">{item.size}</td>

                    <td className="p-5 flex items-center gap-1">
                      <CalendarDays size={14} />
                      {item.date}
                    </td>

                    <td className="p-5">
                      <div className="flex justify-center gap-2">
                        <button className="p-2 rounded-lg hover:bg-slate-700 transition">
                          <PlayCircle size={18} />
                        </button>

                        <button className="p-2 rounded-lg hover:bg-slate-700 transition">
                          <Download size={18} />
                        </button>

                        <button className="p-2 rounded-lg hover:bg-red-500/20 transition text-red-400">
                          <Trash2 size={18} />
                        </button>

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
