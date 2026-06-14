import type { CandidateProfile } from "@/lib/profile-types";

interface CandidateStatsCardsProps {
  profile: CandidateProfile;
}

export default function CandidateStatsCards({
  profile,
}: CandidateStatsCardsProps) {
  const phone = profile.phone || "Chưa cập nhật";
  const cvStatus = profile.cvUrl ? "Uploaded" : "Chưa có";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-sm text-on-surface-variant">Experience</h3>
        <p className="text-3xl font-bold text-primary mt-2">
          {profile.experienceYears} Years
        </p>
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-sm text-on-surface-variant">Phone</h3>
        <p className="text-xl font-bold mt-2">{phone}</p>
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-sm text-on-surface-variant">CV Status</h3>
        <p className="text-xl font-bold text-primary mt-2">{cvStatus}</p>
      </div>
    </div>
  );
}
