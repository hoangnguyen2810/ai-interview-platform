import type { RecruiterProfile } from "@/lib/profile-types";

interface ProfileCompletionProps {
  profile: RecruiterProfile;
}

const CHECKED_KEYS = [
  "companyName",
  "companyWebsite",
  "companyDescription",
  "companyLogoUrl",
  "avatarUrl",
  "position",
  "bio",
  "phone",
  "linkedinUrl",
] as const;

type MissingHint = { key: (typeof CHECKED_KEYS)[number]; label: string };

const HINTS: MissingHint[] = [
  { key: "companyName", label: "Thêm tên công ty" },
  { key: "companyWebsite", label: "Thêm website công ty" },
  { key: "companyDescription", label: "Thêm mô tả công ty" },
  { key: "companyLogoUrl", label: "Thêm ảnh công ty" },
  { key: "avatarUrl", label: "Thêm ảnh đại diện" },
  { key: "position", label: "Thêm chức danh" },
  { key: "bio", label: "Thêm giới thiệu" },
  { key: "phone", label: "Thêm số điện thoại" },
  { key: "linkedinUrl", label: "Liên kết LinkedIn" },
];

function read(profile: RecruiterProfile, key: MissingHint["key"]): string {
  switch (key) {
    case "companyName":
      return profile.company.name;
    case "companyWebsite":
      return profile.company.website;
    case "companyDescription":
      return profile.company.description;
    case "companyLogoUrl":
      return profile.company.logoUrl;
    case "avatarUrl":
      return profile.avatarUrl;
    case "position":
      return profile.position;
    case "bio":
      return profile.bio;
    case "phone":
      return profile.phone;
    case "linkedinUrl":
      return profile.linkedinUrl;
  }
}

export default function ProfileCompletion({ profile }: ProfileCompletionProps) {
  const missing = HINTS.filter((h) => !read(profile, h.key));
  const done = CHECKED_KEYS.length - missing.length;
  const percent = Math.round((done / CHECKED_KEYS.length) * 100);
  const topMissing = missing.slice(0, 3);

  return (
    <div className="p-6 rounded-xl border border-outline-variant bg-surface-container space-y-4">
      <h3 className="font-bold">Hoàn thiện hồ sơ</h3>

      <p className="text-3xl font-bold text-primary">{percent}%</p>

      <div className="h-2 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-container rounded-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      {topMissing.length > 0 ? (
        <ul className="text-sm space-y-2 opacity-70">
          {topMissing.map((m) => (
            <li key={m.key}>• {m.label}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm opacity-70">Hồ sơ đã hoàn thiện 🎉</p>
      )}
    </div>
  );
}
