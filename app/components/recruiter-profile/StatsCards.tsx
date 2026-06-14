import type { RecruiterStats } from "@/lib/profile-types";

interface StatsCardProps {
  stats: RecruiterStats;
}

const formatNumber = (n: number) =>
  new Intl.NumberFormat("vi-VN").format(n ?? 0);

export default function StatsCard({ stats }: StatsCardProps) {
  const items = [
    { label: "Open Jobs", value: stats.openJobs },
    { label: "Applications", value: stats.applications },
    { label: "AI Interviews", value: stats.aiInterviews },
    { label: "Hired", value: stats.hired },
  ];

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((s) => (
        <div
          key={s.label}
          className="p-4 rounded-xl border border-outline-variant bg-surface-container"
        >
          <p className="text-xs opacity-60">{s.label}</p>
          <p className="text-2xl font-bold">{formatNumber(s.value)}</p>
        </div>
      ))}
    </section>
  );
}
