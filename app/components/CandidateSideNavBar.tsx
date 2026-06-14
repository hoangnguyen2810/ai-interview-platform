import Image from "next/image";

const AVATAR_URL = "https://i.pravatar.cc/150?img=12";

const NAV_ITEMS = [
  {
    label: "Insights",
    icon: "psychology",
    href: "/candidate/profile",
    active: true,
  },
  {
    label: "Code Playback",
    icon: "settings_backup_restore",
    href: "/candidate/playback",
  },
];

export function CandidateSideNavBar() {
  return (
    <aside className="fixed left-0 top-16 bottom-0 z-40 hidden md:flex w-[280px] flex-col border-r border-outline-variant bg-surface-container-lowest">
      <div className="px-4 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container">
            <span className="material-symbols-outlined text-on-primary-container">
              neurology
            </span>
          </div>

          <div>
            <p className="text-lg font-black text-primary-fixed">NeuralCode</p>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
              Candidate
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={
              item.active
                ? "flex items-center gap-3 rounded-lg bg-secondary-container px-4 py-3 text-on-secondary-container"
                : "flex items-center gap-3 rounded-lg px-4 py-3 text-on-surface-variant hover:bg-surface-container-highest transition-all"
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>

            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
}
