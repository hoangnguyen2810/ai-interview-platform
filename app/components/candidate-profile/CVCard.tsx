import type { CandidateProfile } from "@/lib/profile-types";

interface CVCardProps {
  profile: CandidateProfile;
}

function fileNameFromUrl(url: string): string {
  try {
    const clean = url.split("?")[0].split("#")[0];
    const last = clean.split("/").pop();
    return last || "cv";
  } catch {
    return "cv";
  }
}

export default function CVCard({ profile }: CVCardProps) {
  const url = profile.cvUrl;

  if (!url) {
    return (
      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="font-bold mb-4">CV File</h3>
        <div className="flex items-center justify-between p-4 bg-surface-container-high rounded-xl text-on-surface-variant text-sm">
          <span>Chưa tải lên CV</span>
          <span>Hãy vào phần Chỉnh sửa để thêm CV</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 rounded-2xl">
      <h3 className="font-bold mb-4">CV File</h3>
      <div className="flex items-center justify-between p-4 bg-surface-container-high rounded-xl">
        <span>{fileNameFromUrl(url)}</span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-primary font-bold hover:underline"
        >
          Download
        </a>
      </div>
    </div>
  );
}
