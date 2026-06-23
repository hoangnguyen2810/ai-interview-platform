import type { RecruiterProfile } from "@/lib/profile-types";

interface AccountInfoProps {
  profile: RecruiterProfile;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN");
}

export default function AccountInfo({ profile }: AccountInfoProps) {
  return (
    <div className="p-6 rounded-xl border border-outline-variant bg-surface-container space-y-4">
      <h3 className="text-lg font-bold">Tài khoản</h3>

      <div className="p-3 rounded bg-surface border border-outline-variant">
        <p className="text-xs opacity-60 mb-1">Vai trò</p>
        <p>Nhà tuyển dụng</p>
      </div>

      <div className="p-3 rounded bg-surface border border-outline-variant">
        <p className="text-xs opacity-60 mb-1">Tham gia</p>
        <p>{formatDate(profile.joinedAt)}</p>
      </div>

      <div className="p-3 rounded bg-surface border border-outline-variant">
        <p className="text-xs opacity-60 mb-1">Truy cập gần nhất</p>
        <p>{formatDateTime(profile.lastLoginAt)}</p>
      </div>

      <div className="p-3 rounded bg-surface border border-outline-variant">
        <p className="text-xs opacity-60 mb-1">Trạng thái</p>
        <p className="text-green-500 font-medium">Đang hoạt động</p>
      </div>
    </div>
  );
}
