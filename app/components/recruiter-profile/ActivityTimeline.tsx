import type { RecruiterActivity } from "@/lib/profile-types";

interface ActivityTimelineProps {
  activities: RecruiterActivity[];
}

function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;

  return d.toLocaleDateString("vi-VN");
}

export default function ActivityTimeline({
  activities,
}: ActivityTimelineProps) {
  return (
    <div className="p-6 rounded-xl border border-outline-variant bg-surface-container space-y-4">
      <h3 className="text-lg font-bold">Hoạt động gần đây</h3>

      {activities.length === 0 ? (
        <p className="text-sm opacity-60">Chưa có hoạt động nào.</p>
      ) : (
        <div className="space-y-4 border-l border-outline-variant pl-4">
          {activities.map((a, idx) => (
            <div key={`${a.type}-${idx}`}>
              <p>Đã tạo phòng phỏng vấn #{a.text.split("#")[1]?.slice(0, 8)}</p>
              <p className="text-xs opacity-60">{timeAgo(a.at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
