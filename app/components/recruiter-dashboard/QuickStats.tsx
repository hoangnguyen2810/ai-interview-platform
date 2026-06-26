type Stat = {
  label: string;
  value: string;
  description: string;
  icon: string;
  valueClass: string;
  iconClass: string;
};

const STATS: Stat[] = [
  {
    label: "Tháng này",
    value: "28",
    description: "Tổng số buổi phỏng vấn",
    icon: "event_available",
    valueClass: "text-primary-fixed",
    iconClass: "text-primary-fixed-dim",
  },
  {
    label: "Hôm nay",
    value: "4",
    description: "Tổng số buổi phỏng vấn",
    icon: "event_available",
    valueClass: "text-primary-fixed",
    iconClass: "text-primary-fixed-dim",
  },
  {
    label: "Hoàn thành",
    value: "21",
    description: "Đã hoàn tất phỏng vấn",
    icon: "check_circle",
    valueClass: "text-tertiary",
    iconClass: "text-tertiary",
  },
];

export function QuickStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-10">
      {STATS.map((stat) => (
        <div
          key={stat.label}
          className="glass-card p-6 rounded-2xl neon-border-hover transition-all group"
        >
          <div className="flex justify-between items-start mb-4">
            <span className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
              {stat.label}
            </span>
            <span className={`material-symbols-outlined ${stat.iconClass}`}>
              {stat.icon}
            </span>
          </div>
          <div className={`text-4xl font-bold ${stat.valueClass} mb-1`}>
            {stat.value}
          </div>
          <div className="text-sm text-on-surface-variant">
            {stat.description}
          </div>
        </div>
      ))}
    </div>
  );
}
