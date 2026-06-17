"use client";

const participants = [
  {
    name: "Hung Nguyen (You)",
    role: "Candidate",
    avatar: "H",
    live: true,
  },
  {
    name: "Technical Interviewer",
    role: "Interviewer",
    avatar: "I",
    live: false,
  },
];

interface SidebarProps {
  showLiveCoding: boolean;
}

export default function Sidebar({ showLiveCoding }: SidebarProps) {
  const gridClass = showLiveCoding
    ? participants.length <= 2
      ? "grid-cols-1 grid-rows-2"
      : "grid-cols-2 grid-rows-2"
    : participants.length === 1
      ? "grid-cols-1"
      : participants.length === 2
        ? "grid-cols-2"
        : "grid-cols-2 grid-rows-2";

  return (
    <div className={`w-full h-full grid gap-4 ${gridClass}`}>
      {participants.map((participant, index) => (
        <div
          key={index}
          className="
            rounded-2xl
            bg-[#0d1c2d]
            border border-[#23384d]
            relative
            overflow-hidden
            flex items-center justify-center
            shadow-lg
            hover:border-cyan-400/40
            transition-all
          "
        >
          {/* Label */}
          <div className="absolute top-3 left-3 text-[10px] uppercase tracking-wider text-cyan-400/70">
            {participant.role}
          </div>

          {/* Avatar */}
          <div
            className="
              w-36 h-36
              rounded-full
              bg-gradient-to-br
              from-cyan-500
              to-blue-600
              flex items-center justify-center
              shadow-[0_0_30px_rgba(0,240,255,0.3)]
            "
          >
            <span className="text-5xl font-bold text-white">
              {participant.avatar}
            </span>
          </div>

          {/* Name */}
          <div
            className="
              absolute bottom-3 left-3
              px-3 py-1.5
              rounded-lg
              bg-black/40
              backdrop-blur-md
              border border-white/10
            "
          >
            <span className="text-sm text-white">{participant.name}</span>
          </div>

          {/* Status */}
          <div className="absolute top-3 right-3 flex items-center gap-1">
            {participant.live ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-green-300">LIVE</span>
              </>
            ) : (
              <span className="material-symbols-outlined text-cyan-300 text-lg">
                mic
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
