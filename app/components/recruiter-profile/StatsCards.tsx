const stats = [
  { label: "Open Jobs", value: 14 },
  { label: "Applications", value: 342 },
  { label: "AI Interviews", value: 1284 },
  { label: "Hired", value: 86 },
];

export default function StatsCard() {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="p-4 rounded-xl border border-outline-variant bg-surface-container"
        >
          <p className="text-xs opacity-60">{s.label}</p>
          <p className="text-2xl font-bold">{s.value}</p>
        </div>
      ))}
    </section>
  );
}
