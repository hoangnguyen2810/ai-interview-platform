import type { CandidateProfile } from "@/lib/profile-types";

interface ProfileStatusCardProps {
  profile: CandidateProfile;
}

const ITEMS = [
  { key: "phone", label: "Phone" },
  { key: "github", label: "GitHub" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "cv", label: "CV" },
] as const;

export default function ProfileStatusCard({ profile }: ProfileStatusCardProps) {
  return (
    <div className="glass-panel p-6 rounded-2xl">
      <h3 className="font-bold mb-4">Trạng thái hồ sơ</h3>

      <div className="space-y-3 text-sm">
        {ITEMS.map((item) => {
          const done = profile.status[item.key];
          return (
            <div key={item.key} className="flex justify-between">
              <span>{item.label}</span>
              <span
                className={done ? "text-primary" : "text-on-surface-variant"}
              >
                {done ? "✔" : "✕"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
