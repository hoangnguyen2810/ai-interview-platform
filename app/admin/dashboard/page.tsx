"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/app/components/admin-dashboard/AdminShell";
import { AdminStatsCard } from "@/app/components/admin-dashboard/AdminStatsCard";
import { useAdminGuard } from "@/app/components/admin-dashboard/useAdminGuard";
import { adminFetch } from "@/app/components/admin-dashboard/api";

type StatsPayload = {
  users: { total: number; byRole: Record<string, number> };
  interviews: { total: number; byStatus: Record<string, number> };
  recordings: { total: number; byStatus: Record<string, number> };
  questions: { total: number };
  aiReviews: { total: number };
  reports: { total: number; byStatus: Record<string, number> };
  aiTestCases: { total: number };
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Quản trị viên",
  RECRUITER: "Nhà tuyển dụng",
  CANDIDATE: "Ứng viên",
};

export default function AdminDashboardPage() {
  const { ready } = useAdminGuard();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch("/api/admin/stats");
        const data = await res.json();
        if (cancelled) return;
        if (!data?.success) throw new Error(data?.message || "Lỗi");
        setStats(data.stats);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Lỗi tải thống kê");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) {
    return (
      <AdminShell>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Bảng điều khiển Admin</h1>
        <p className="mt-1 text-sm text-slate-400">
          Tổng quan nhanh về người dùng, phỏng vấn, báo cáo, AI.
        </p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {!stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-5 animate-pulse"
            >
              <div className="h-3 w-24 bg-slate-700 rounded mb-3" />
              <div className="h-8 w-16 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <AdminStatsCard
              label="Người dùng"
              value={stats.users.total}
              icon="group"
              accent="cyan"
            />
            <AdminStatsCard
              label="Buổi phỏng vấn"
              value={stats.interviews.total}
              icon="calendar_today"
              accent="violet"
            />
            <AdminStatsCard
              label="Bản ghi hình"
              value={stats.recordings.total}
              icon="video_library"
              accent="emerald"
            />
            <AdminStatsCard
              label="AI Review"
              value={stats.aiReviews.total}
              icon="auto_awesome"
              accent="amber"
            />
            <AdminStatsCard
              label="Báo cáo đánh giá"
              value={stats.reports.total}
              icon="analytics"
              accent="cyan"
            />
            <AdminStatsCard
              label="Câu hỏi lập trình"
              value={stats.questions.total}
              icon="code"
              accent="violet"
            />
            <AdminStatsCard
              label="Test case AI"
              value={stats.aiTestCases.total}
              icon="science"
              accent="amber"
            />
            <AdminStatsCard
              label="Admin"
              value={stats.users.byRole.ADMIN || 0}
              icon="admin_panel_settings"
              accent="rose"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BreakdownCard
              title="Người dùng theo vai trò"
              items={stats.users.byRole}
              accent="cyan"
            />
            <BreakdownCard
              title="Phỏng vấn theo trạng thái"
              items={stats.interviews.byStatus}
              accent="violet"
            />
            <BreakdownCard
              title="Báo cáo theo trạng thái"
              items={stats.reports.byStatus}
              accent="emerald"
            />
          </div>
        </>
      )}
    </AdminShell>
  );
}

function BreakdownCard({
  title,
  items,
  accent,
}: {
  title: string;
  items: Record<string, number>;
  accent: "cyan" | "violet" | "emerald";
}) {
  const total = Object.values(items).reduce((a, b) => a + b, 0) || 1;
  const colors: Record<string, string> = {
    cyan: "bg-cyan-500",
    violet: "bg-violet-500",
    emerald: "bg-emerald-500",
  };
  return (
    <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-4 space-y-2">
        {Object.entries(items).map(([k, v]) => (
          <div key={k} className="flex items-center gap-3">
            <span className="w-24 text-xs text-slate-400 truncate">
              {ROLE_LABEL[k] || k}
            </span>
            <div className="flex-grow h-2 bg-slate-800 rounded overflow-hidden">
              <div
                className={colors[accent]}
                style={{ width: `${(v / total) * 100}%`, height: "100%" }}
              />
            </div>
            <span className="w-10 text-right text-xs text-slate-300">{v}</span>
          </div>
        ))}
        {Object.keys(items).length === 0 && (
          <p className="text-xs text-slate-500">Chưa có dữ liệu.</p>
        )}
      </div>
    </div>
  );
}
