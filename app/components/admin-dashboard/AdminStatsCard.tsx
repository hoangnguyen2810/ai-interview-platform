"use client";

type StatsCardProps = {
  label: string;
  value: number | string;
  delta?: number;
  icon?: string;
  accent?: "cyan" | "amber" | "emerald" | "rose" | "violet";
};

const accentClass: Record<NonNullable<StatsCardProps["accent"]>, string> = {
  cyan: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",
  amber: "text-amber-400 bg-amber-500/15 border-amber-500/30",
  emerald: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  rose: "text-rose-400 bg-rose-500/15 border-rose-500/30",
  violet: "text-violet-400 bg-violet-500/15 border-violet-500/30",
};

export function AdminStatsCard({
  label,
  value,
  delta,
  icon = "analytics",
  accent = "cyan",
}: StatsCardProps) {
  const a = accentClass[accent];
  return (
    <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-5 hover:-translate-y-1 transition shadow-md shadow-black/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold text-white">{value}</p>
          {typeof delta === "number" && (
            <p
              className={
                delta >= 0
                  ? "mt-1 text-xs text-emerald-400"
                  : "mt-1 text-xs text-rose-400"
              }
            >
              {delta >= 0 ? "+" : ""}
              {delta} tuần này
            </p>
          )}
        </div>
        <div
          className={`w-11 h-11 rounded-xl border flex items-center justify-center ${a}`}
        >
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
      </div>
    </div>
  );
}
