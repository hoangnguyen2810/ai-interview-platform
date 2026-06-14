"use client";

import type { CandidateProfile } from "@/lib/profile-types";

interface CandidateHeaderProps {
  onEdit: () => void;
  profile: CandidateProfile;
}

const FALLBACK_AVATAR = "https://i.pravatar.cc/150?img=12";

export default function CandidateHeader({
  onEdit,
  profile,
}: CandidateHeaderProps) {
  const name = profile.fullName || "Chưa cập nhật";
  const username = profile.email ? profile.email.split("@")[0] : "user";
  const phone = profile.phone || "Chưa cập nhật SĐT";
  const experience = profile.experienceYears ?? 0;
  const avatar = profile.avatarUrl || FALLBACK_AVATAR;
  const cvUrl = profile.cvUrl;

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
      <div className="flex items-center gap-6">
        <img
          src={avatar}
          alt={name}
          className="w-24 h-24 rounded-2xl border border-primary-fixed object-cover"
        />

        <div>
          <h1 className="text-2xl font-bold text-primary">{name}</h1>

          <p className="text-on-surface-variant">@{username}</p>

          <div className="flex gap-3 mt-3 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-surface-container-high text-sm">
              💼 {experience} năm kinh nghiệm
            </span>

            <span className="px-3 py-1 rounded-full bg-surface-container-high text-sm">
              📞 {phone}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        {cvUrl ? (
          <a
            href={cvUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container font-bold hover:brightness-110 transition"
          >
            View CV
          </a>
        ) : (
          <span className="px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant text-sm">
            Chưa có CV
          </span>
        )}

        <button
          onClick={onEdit}
          className="px-4 py-2 rounded-xl border border-outline-variant bg-surface-container-high hover:bg-surface-container-highest transition flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
          Edit Profile
        </button>
      </div>
    </div>
  );
}
