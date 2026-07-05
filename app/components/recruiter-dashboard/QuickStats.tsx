"use client";

import { useCallback, useEffect, useState } from "react";
import { useRecruiterDashboard } from "./DashboardContext";

type ApiStats = {
  total: number;
  scheduled: number;
  ongoing: number;
  finished: number;
  thisMonth: number;
  today: number;
};

type StatCardProps = {
  label: string;
  value: number | null;
  description: string;
  icon: string;
  valueClass: string;
  iconClass: string;
  loading: boolean;
};

function StatCard({
  label,
  value,
  description,
  icon,
  valueClass,
  iconClass,
  loading,
}: StatCardProps) {
  return (
    <div className="glass-card p-6 rounded-2xl neon-border-hover transition-all group">
      <div className="flex justify-between items-start mb-4">
        <span className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
          {label}
        </span>
        <span className={`material-symbols-outlined ${iconClass}`}>
          {icon}
        </span>
      </div>
      <div className={`text-4xl font-bold ${valueClass} mb-1`}>
        {loading || value === null ? (
          <span className="inline-block w-14 h-9 rounded-md bg-surface-container-high animate-pulse" />
        ) : (
          value.toLocaleString("vi-VN")
        )}
      </div>
      <div className="text-sm text-on-surface-variant">{description}</div>
    </div>
  );
}

export function QuickStats() {
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { subscribeInterviewCreated, subscribeInterviewFinished } =
    useRecruiterDashboard();

  const fetchStats = useCallback(async () => {
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("token")
          : null;
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // limit=1: chỉ cần stats, không cần list đầy đủ.
      const res = await fetch("/api/interviews?limit=1", {
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Response không phải JSON");
      }

      const json = await res.json();
      if (json?.stats) {
        setStats({
          total: Number(json.stats.total ?? 0),
          scheduled: Number(json.stats.scheduled ?? 0),
          ongoing: Number(json.stats.ongoing ?? 0),
          finished: Number(json.stats.finished ?? 0),
          thisMonth: Number(json.stats.thisMonth ?? 0),
          today: Number(json.stats.today ?? 0),
        });
      }
    } catch (err) {
      console.error("[quick-stats] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Đồng bộ: tạo mới hoặc kết thúc → refresh
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

  const cards = [
    {
      label: "Tháng này",
      value: stats?.thisMonth ?? null,
      description: "Tổng số buổi phỏng vấn",
      icon: "event_available",
      valueClass: "text-primary-fixed",
      iconClass: "text-primary-fixed-dim",
    },
    {
      label: "Hôm nay",
      value: stats?.today ?? null,
      description: "Tổng số buổi phỏng vấn",
      icon: "today",
      valueClass: "text-primary-fixed",
      iconClass: "text-primary-fixed-dim",
    },
    {
      label: "Hoàn thành",
      value: stats?.finished ?? null,
      description: "Đã hoàn tất phỏng vấn",
      icon: "check_circle",
      valueClass: "text-tertiary",
      iconClass: "text-tertiary",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-10">
      {cards.map((stat) => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          description={stat.description}
          icon={stat.icon}
          valueClass={stat.valueClass}
          iconClass={stat.iconClass}
          loading={loading}
        />
      ))}
    </div>
  );
}