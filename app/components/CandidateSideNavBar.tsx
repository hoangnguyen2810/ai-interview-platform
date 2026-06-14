import Image from "next/image";

type NavItem = {
  label: string;
  icon: string;
  href: string;
  active?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Tổng quan",
    items: [{ label: "Dashboard", icon: "dashboard", href: "#", active: true }],
  },
  {
    title: "Phỏng vấn",
    items: [
      { label: "Lịch phỏng vấn", icon: "calendar_today", href: "#" },
      { label: "Phòng luyện tập", icon: "video_chat", href: "#" },
      { label: "Kết quả phỏng vấn", icon: "assignment_turned_in", href: "#" },
    ],
  },
  {
    title: "Tài nguyên",
    items: [
      { label: "Câu hỏi luyện tập", icon: "quiz", href: "#" },
      { label: "Kho kiến thức", icon: "menu_book", href: "#" },
    ],
  },
  {
    title: "Cá nhân",
    items: [
      { label: "CV của tôi", icon: "description", href: "#" },
      { label: "Hồ sơ cá nhân", icon: "person", href: "#" },
      { label: "Cài đặt", icon: "settings", href: "#" },
    ],
  },
];

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCSpTS4TcvgRo-5gFUy0QNjo0qcafkU-u-vhMh3b3_-ZYIrTK54Yx4M4Co2A4xSsEupm9_fQ1ctdSWSqV1QpYTLCqMjVQX-d4l0NcB3bPrwtaw0TnvaGaQPligilB1VTbB3vjzX5FwJp_-nXyhdueUYOJ_3WVZgDeOUoXBhwlTunGQhbm0VkhtiADRb-H2Fxmvlxg6L8JDzQZuJ2U2FkB6mBpaK-Ver6tyETXUwdBKIh5_msB5P45muwzBk-3X1mlisFisNfBOZx_8";

export function CandidateSideNavBar() {
  return (
    <aside className="bg-surface-container-lowest border-r border-outline-variant flex flex-col h-full w-sidebar-width fixed left-0 top-16 bottom-0 hidden md:flex z-40">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="px-4 py-6 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-sm">
                psychology
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-lg font-black text-primary-fixed leading-none">
                NeuralCode AI
              </span>
              <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                Candidate Portal
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-grow overflow-y-auto px-2 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                {group.title}
              </h3>

              <div className="space-y-1">
                {group.items.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className={
                      item.active
                        ? "flex items-center gap-3 px-4 py-2.5 bg-secondary-container text-on-secondary-container rounded-lg"
                        : "flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition"
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {item.icon}
                    </span>
                    <span className="text-sm">{item.label}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* User */}
        <div className="p-4 border-t border-outline-variant">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-surface-container">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-primary-fixed">
              <Image src={AVATAR_URL} alt="avatar" width={32} height={32} />
            </div>

            <div className="flex flex-col">
              <span className="text-xs font-bold">Candidate</span>
              <span className="text-[10px] text-on-surface-variant">User</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
