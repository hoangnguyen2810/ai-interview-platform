interface CandidateHeaderProps {
  onEdit: () => void;
}

export default function CandidateHeader({ onEdit }: CandidateHeaderProps) {
  const data = {
    name: "Nguyễn Văn A",
    username: "candidate_dev",
    phone: "+84 912 345 678",
    experience_years: 3,
    avatar: "https://i.pravatar.cc/150?img=12",
    cv_url: "/cv.pdf",
  };

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
      <div className="flex items-center gap-6">
        <img
          src={data.avatar}
          alt={data.name}
          className="w-24 h-24 rounded-2xl border border-primary-fixed object-cover"
        />

        <div>
          <h1 className="text-2xl font-bold text-primary">{data.name}</h1>

          <p className="text-on-surface-variant">@{data.username}</p>

          <div className="flex gap-3 mt-3 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-surface-container-high text-sm">
              💼 {data.experience_years} năm kinh nghiệm
            </span>

            <span className="px-3 py-1 rounded-full bg-surface-container-high text-sm">
              📞 {data.phone}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <a
          href={data.cv_url}
          target="_blank"
          className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container font-bold hover:brightness-110 transition"
        >
          View CV
        </a>

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
