"use client";

import type { ReactNode } from "react";

export interface SidebarParticipant {
  name: string;
  role: string;
  avatar: string;
}

export interface SidebarCurrentUser extends SidebarParticipant {
  /** "candidate" hoặc "recruiter" */
  roleKey: "candidate" | "recruiter";
}

interface SidebarProps {
  showLiveCoding: boolean;
  currentUser: SidebarCurrentUser;
  otherParticipant: SidebarParticipant;
  /** Slot local preview do InterviewRoomClient truyền vào (đã wrap stream + camOn) */
  localPreviewSlot: ReactNode;
}

export default function Sidebar({
  showLiveCoding,
  currentUser,
  otherParticipant,
  localPreviewSlot,
}: SidebarProps) {
  const participants = [currentUser, otherParticipant];

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
      {participants.map((participant, index) => {
        const isYou =
          "roleKey" in participant &&
          (participant as SidebarCurrentUser).roleKey === currentUser.roleKey;

        if (isYou) {
          return <div key={`you-${index}`}>{localPreviewSlot}</div>;
        }

        return (
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
            <div className="absolute top-3 left-3 text-[10px] uppercase tracking-wider text-cyan-400/70">
              {participant.role}
            </div>

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

            <div className="absolute top-3 right-3 flex items-center gap-1">
              <span className="text-[10px] text-gray-400">WAITING</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
