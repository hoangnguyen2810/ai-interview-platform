import type { RecruiterProfile } from "@/lib/profile-types";

interface CompanyInfoProps {
  profile: RecruiterProfile;
}

export default function CompanyInfo({ profile }: CompanyInfoProps) {
  const c = profile.company;
  const fallbackLogo = "https://placehold.co/96x96?text=Co";

  return (
    <div className="p-6 rounded-xl border border-outline-variant bg-surface-container space-y-4">
      <h3 className="text-lg font-bold">Công ty</h3>

      <div className="flex items-center gap-3">
        <img
          src={c.logoUrl || fallbackLogo}
          alt={c.name || "Company logo"}
          className="w-12 h-12 rounded-lg object-cover bg-white"
        />
        <div>
          <p className="font-semibold">{c.name || "Chưa cập nhật"}</p>
          <p className="text-xs opacity-60">{profile.position}</p>
        </div>
      </div>

      <p className="text-sm opacity-70 whitespace-pre-line">
        {c.description || "Chưa có mô tả công ty."}
      </p>

      {c.website && (
        <a
          className="
  text-primary
  no-underline
  break-all
  transition-all duration-300
  hover:text-primary-fixed
  hover:drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]
"
          href={c.website}
          target="_blank"
          rel="noreferrer"
        >
          {c.website}
        </a>
      )}
    </div>
  );
}
