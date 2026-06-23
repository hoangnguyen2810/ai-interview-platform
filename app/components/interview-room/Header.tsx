interface HeaderProps {
  title?: string;
  meetingCode?: string;
  role?: "candidate" | "recruiter";
}

export default function Header({ title, meetingCode, role }: HeaderProps) {
  return (
    <header className="w-full flex justify-between items-center z-10">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-cyan-400 rounded-[8px] flex items-center justify-center">
          <svg
            className="h-5 w-5 text-[#051424]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M13 10V3L4 14h7v7l9-11h-7z"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <span className="font-bold text-xl tracking-tight">
          NEURAL
          <span className="text-cyan-400">CodePilot AI</span>
        </span>
      </div>

      <div className="bg-[#2c3a4c]/30 px-3 py-1 rounded-full text-xs font-medium text-gray-400 border border-white/5">
        {meetingCode ?? "INTERVIEW_ID: NS-992"}
        {title ? ` • ${title}` : ""}
        {role ? ` • ${role.toUpperCase()}` : ""}
      </div>
    </header>
  );
}
