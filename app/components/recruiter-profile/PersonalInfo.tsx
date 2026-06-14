import type { RecruiterProfile } from "@/lib/profile-types";

interface PersonalInfoProps {
  profile: RecruiterProfile;
}

export default function PersonalInfo({ profile }: PersonalInfoProps) {
  return (
    <div className="p-6 rounded-xl border border-outline-variant bg-surface-container space-y-4">
      <h3 className="text-lg font-bold">Thông tin cá nhân</h3>

      <div>
        <p className="text-xs opacity-60">Email</p>
        <div className="p-3 bg-surface rounded-lg">
          {profile.email || "—"}
        </div>
      </div>

      <div>
        <p className="text-xs opacity-60">Phone</p>
        <div className="p-3 bg-surface rounded-lg">{profile.phone || "—"}</div>
      </div>

      <div>
        <p className="text-xs opacity-60">Position</p>
        <div className="p-3 bg-surface rounded-lg">
          {profile.position || "—"}
        </div>
      </div>

      <div>
        <p className="text-xs opacity-60">Bio</p>
        <div className="p-3 bg-surface rounded-lg whitespace-pre-line">
          {profile.bio || "—"}
        </div>
      </div>

      {profile.linkedinUrl && (
        <div>
          <p className="text-xs opacity-60">LinkedIn</p>
          <a
            href={profile.linkedinUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline break-all"
          >
            {profile.linkedinUrl}
          </a>
        </div>
      )}
    </div>
  );
}
