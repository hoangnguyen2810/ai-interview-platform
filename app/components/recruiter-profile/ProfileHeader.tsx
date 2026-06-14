"use client";

import type { RecruiterProfile } from "@/lib/profile-types";

interface ProfileHeaderProps {
  profile: RecruiterProfile;
  onEdit?: () => void;
}

const FALLBACK_AVATAR = "https://i.pravatar.cc/150";

export default function ProfileHeader({ profile, onEdit }: ProfileHeaderProps) {
  const name = profile.fullName || "Chưa cập nhật";
  const position = profile.position || "Recruiter";
  const company = profile.company.name || "Chưa cập nhật công ty";
  const avatar = profile.avatarUrl || FALLBACK_AVATAR;

  return (
    <section className="p-6 rounded-xl border border-outline-variant bg-surface-container flex flex-col md:flex-row gap-6">
      <img
        src={avatar}
        alt={name}
        className="w-28 h-28 rounded-xl object-cover"
      />

      <div className="flex-1 space-y-2">
        <h2 className="text-3xl font-bold">{name}</h2>

        <span className="inline-block px-3 py-1 bg-secondary-container rounded-full text-sm">
          {position}
        </span>

        <p className="text-sm opacity-70">{company}</p>

        <div className="flex gap-3 mt-4">
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-primary-container rounded-lg"
          >
            Edit Profile
          </button>
          {profile.company.website && (
            <a
              className="px-4 py-2 border rounded-lg"
              href={profile.company.website}
              target="_blank"
              rel="noreferrer"
            >
              Public Page
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
