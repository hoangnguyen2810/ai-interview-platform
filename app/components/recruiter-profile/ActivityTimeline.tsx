const items = [
  { text: "Created interview room #402", time: "2h ago" },
  { text: "Evaluated candidate Trần Thị B", time: "Yesterday" },
  { text: "Updated job AI Engineer", time: "Oct 24" },
];

export default function ActivityTimeline() {
  return (
    <div className="p-6 rounded-xl border border-outline-variant bg-surface-container space-y-4">
      <h3 className="text-lg font-bold">Hoạt động gần đây</h3>

      <div className="space-y-4 border-l border-outline-variant pl-4">
        {items.map((i) => (
          <div key={i.text}>
            <p>{i.text}</p>
            <p className="text-xs opacity-60">{i.time}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
