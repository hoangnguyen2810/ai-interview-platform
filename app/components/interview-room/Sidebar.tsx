function Participant({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs">{name}</span>
      <span className="text-[8px] px-2 py-1 rounded bg-white/10 uppercase">
        {role}
      </span>
    </div>
  );
}

export default function Sidebar() {
  return (
    <div className="w-full lg:w-[30%] flex flex-col gap-4 overflow-hidden">
      {/* CANDIDATE */}
      <div className="aspect-video bg-[#0d1c2d] rounded-lg border border-white/5 flex items-center justify-center relative">
        <div className="w-32 h-32 rounded-full bg-green-600 flex items-center justify-center">
          <span className="text-6xl font-bold">H</span>
        </div>

        <div className="absolute top-2 left-2 text-[8px] text-white/40 uppercase">
          Candidate
        </div>

        <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur px-2 py-1 rounded">
          <span className="text-[10px]">hung nguyen (You)</span>
        </div>
      </div>

      {/* INTERVIEWER */}
      <div className="h-40 bg-[#0d1c2d] rounded-lg border border-white/5 flex items-center justify-center relative">
        <div className="relative w-16 h-16 rounded-full overflow-hidden border border-cyan-400/30">
          <img
            src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e"
            alt="Interviewer"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="absolute top-2 left-2 text-[8px] uppercase text-white/40">
          Interviewer
        </div>

        <div className="absolute bottom-2 left-2 bg-black/40 px-2 py-1 rounded">
          <span className="text-[10px]">Hung Nguyen</span>
        </div>
      </div>

      {/* PARTICIPANTS */}
      <div className="flex-grow bg-[#0d1c2d]/80 backdrop-blur rounded-lg border border-white/10 overflow-hidden">
        <div className="flex border-b border-white/10">
          <button className="flex-1 py-2 text-xs font-bold uppercase text-cyan-400 border-b-2 border-cyan-400">
            Participants
          </button>

          <button className="flex-1 py-2 text-xs font-bold uppercase text-white/40">
            Notes
          </button>
        </div>

        <div className="p-4 space-y-3">
          <Participant name="Hung Nguyen (You)" role="Candidate" />

          <Participant name="Hung Nguyen" role="Interviewer" />

          <Participant name="Jane Doe" role="Observer" />
        </div>
      </div>
    </div>
  );
}
