import type { RecruiterProfile } from "@/lib/profile-types";

interface PersonalInfoProps {
  profile: RecruiterProfile;
}

export default function PersonalInfo({ profile }: PersonalInfoProps) {
  return (
    <div
      className="
        p-6
        rounded-3xl
        border border-outline-variant
        bg-surface-container
        shadow-sm
        space-y-6
      "
    >
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary">badge</span>

        <h3 className="text-xl font-bold">Thông tin cá nhân</h3>
      </div>

      <div className="grid gap-4">
        {/* Email */}
        <div className="p-4 rounded-2xl bg-surface hover:bg-surface-container-high transition">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[18px] opacity-70">
              mail
            </span>
            <p className="text-xs uppercase tracking-wide opacity-60">Email</p>
          </div>

          <p className="font-medium break-all">{profile.email}</p>
        </div>

        {/* Phone */}
        <div className="p-4 rounded-2xl bg-surface hover:bg-surface-container-high transition">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[18px] opacity-70">
              call
            </span>
            <p className="text-xs uppercase tracking-wide opacity-60">
              Số điện thoại
            </p>
          </div>

          <p className="font-medium">{profile.phone}</p>
        </div>

        {/* Position */}
        <div className="p-4 rounded-2xl bg-surface hover:bg-surface-container-high transition">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[18px] opacity-70">
              work
            </span>
            <p className="text-xs uppercase tracking-wide opacity-60">Vị trí</p>
          </div>

          <p className="font-medium">{profile.position}</p>
        </div>

        {/* Bio */}
        <div className="p-4 rounded-2xl bg-surface hover:bg-surface-container-high transition">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[18px] opacity-70">
              description
            </span>
            <p className="text-xs uppercase tracking-wide opacity-60">
              Giới thiệu
            </p>
          </div>

          <p className="whitespace-pre-line leading-relaxed">{profile.bio}</p>
        </div>

        {/* LinkedIn */}
        {profile.linkedinUrl && (
          <div className="p-4 rounded-2xl bg-surface hover:bg-surface-container-high transition">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[18px] opacity-70">
                language
              </span>
              <p className="text-xs uppercase tracking-wide opacity-60">
                LinkedIn
              </p>
            </div>

            <a
              href={profile.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="
                text-primary
                hover:text-primary-fixed
                transition
                break-all
              "
            >
              {profile.linkedinUrl}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
