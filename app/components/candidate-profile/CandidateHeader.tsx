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
    <div
      className="
      glass-panel
      rounded-3xl
      p-8
      border border-outline-variant
      shadow-[0_10px_40px_rgba(0,0,0,0.15)]
      backdrop-blur-xl
    "
    >
      <div className="flex flex-col xl:flex-row justify-between gap-8">
        {/* LEFT */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative">
            <img
              src={avatar}
              alt={name}
              className="
              w-28 h-28
              rounded-3xl
              object-cover
              border-4 border-primary-fixed/30
              shadow-lg
            "
            />

            <div
              className="
              absolute -bottom-1 -right-1
              w-6 h-6
              rounded-full
              bg-green-500
              border-2 border-white
            "
            />
          </div>

          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-bold text-primary">{name}</h1>

            <p className="text-on-surface-variant mt-1">@{username}</p>

            <div className="flex flex-wrap gap-3 mt-4">
              <div
                className="
                flex items-center gap-2
                px-4 py-2
                rounded-xl
                bg-surface-container-high
                text-sm
              "
              >
                <span className="material-symbols-outlined text-[18px]">
                  work_history
                </span>
                {experience} năm kinh nghiệm
              </div>

              <div
                className="
                flex items-center gap-2
                px-4 py-2
                rounded-xl
                bg-surface-container-high
                text-sm
              "
              >
                <span className="material-symbols-outlined text-[18px]">
                  call
                </span>

                {phone}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-wrap gap-3 items-start">
          {cvUrl ? (
            <a
              href={cvUrl}
              target="_blank"
              rel="noreferrer"
              className="
              flex items-center gap-2
              px-5 py-3
              rounded-xl
              bg-primary-container
              text-on-primary-container
              font-semibold
              hover:brightness-110
              transition-all duration-300
            "
            >
              <span className="material-symbols-outlined">description</span>
              Xem CV
            </a>
          ) : (
            <div
              className="
              flex items-center gap-2
              px-5 py-3
              rounded-xl
              border border-outline-variant
              text-on-surface-variant
            "
            >
              <span className="material-symbols-outlined">description</span>
              Chưa có CV
            </div>
          )}

          <button
            onClick={onEdit}
            className="
            flex items-center gap-2
            px-5 py-3
            rounded-xl
            border border-outline-variant
            bg-surface-container-high
            hover:bg-surface-container-highest
            hover:scale-[1.02]
            transition-all duration-300
          "
          >
            <span className="material-symbols-outlined">edit</span>
            Chỉnh sửa hồ sơ
          </button>
        </div>
      </div>
    </div>
  );
}
