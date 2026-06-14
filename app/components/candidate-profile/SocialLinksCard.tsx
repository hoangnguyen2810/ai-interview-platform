import type { CandidateProfile } from "@/lib/profile-types";

interface SocialLinksCardProps {
  profile: CandidateProfile;
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SocialLink({
  label,
  url,
  emptyText,
}: {
  label: string;
  url: string;
  emptyText: string;
}) {
  if (!url) {
    return (
      <div className="flex justify-between p-3 rounded-xl bg-surface-container-high text-on-surface-variant text-sm">
        <span>{label}</span>
        <span>{emptyText}</span>
      </div>
    );
  }

  return (
    <a
      className="flex justify-between p-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest transition"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      <span>{label}</span>
      <span className="text-primary text-sm">{getHostname(url)}</span>
    </a>
  );
}

export default function SocialLinksCard({ profile }: SocialLinksCardProps) {
  return (
    <div className="glass-panel rounded-2xl p-6">
      <h3 className="font-bold mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">link</span>
        Profiles
      </h3>

      <div className="flex flex-col gap-3">
        <SocialLink
          label="GitHub"
          url={profile.githubUrl}
          emptyText="Chưa liên kết"
        />
        <SocialLink
          label="LinkedIn"
          url={profile.linkedinUrl}
          emptyText="Chưa liên kết"
        />
      </div>
    </div>
  );
}
