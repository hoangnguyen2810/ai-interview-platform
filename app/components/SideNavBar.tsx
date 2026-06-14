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
      { label: "Phòng phỏng vấn", icon: "video_chat", href: "#" },
    ],
  },
  {
    title: "AI & Phân tích",
    items: [
      { label: "AI Assistant", icon: "smart_toy", href: "#" },
      { label: "Phân tích & Báo cáo", icon: "analytics", href: "#" },
      { label: "Thống kê", icon: "pie_chart", href: "#" },
    ],
  },
  {
    title: "Lưu trữ",
    items: [
      { label: "Kho lưu trữ", icon: "folder", href: "#" },
      { label: "Video & Recordings", icon: "video_library", href: "#" },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { label: "Cài đặt", icon: "settings", href: "#" },
      { label: "Trợ giúp & Hỗ trợ", icon: "help", href: "#" },
    ],
  },
];

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCSpTS4TcvgRo-5gFUy0QNjo0qcafkU-u-vhMh3b3_-ZYIrTK54Yx4M4Co2A4xSsEupm9_fQ1ctdSWSqV1QpYTLCqMjVQX-d4l0NcB3bPrwtaw0TnvaGaQPligilB1VTbB3vjzX5FwJp_-nXyhdueUYOJ_3WVZgDeOUoXBhwlTunGQhbm0VkhtiADRb-H2Fxmvlxg6L8JDzQZuJ2U2FkB6mBpaK-Ver6tyETXUwdBKIh5_msB5P45muwzBk-3X1mlisFisNfBOZx_8";

export function SideNavBar() {
  return (
    <aside className="bg-surface-container-lowest border-r border-outline-variant flex flex-col h-full w-sidebar-width fixed left-0 top-16 bottom-0 hidden md:flex z-40">
      <div className="flex flex-col h-full">
        <div className="px-4 py-6 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-sm">
                psychology
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-lg text-lg font-black text-primary-fixed tracking-tight leading-none">
                NeuralCode AI
              </span>
              <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                Interview Platform
              </span>
            </div>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto px-2 space-y-6 custom-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <h3 className="px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                {group.title}
              </h3>
              {group.items.map((item) => (
                <a
                  key={item.label}
                  className={
                    item.active
                      ? "flex items-center gap-3 px-4 py-2.5 bg-secondary-container text-on-secondary-container rounded-lg shadow-[0_0_15px_rgba(87,27,193,0.3)] transition-all"
                      : "flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-primary-fixed hover:bg-surface-container-highest rounded-lg transition-all"
                  }
                  href={item.href}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {item.icon}
                  </span>
                  <span className="font-label-sm text-label-sm">
                    {item.label}
                  </span>
                </a>
              ))}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-outline-variant">
          <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container hover:bg-surface-container-high transition-all cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border border-primary-fixed overflow-hidden">
                <Image
                  alt="Nguyễn Văn Quân"
                  className="w-full h-full object-cover"
                  src={AVATAR_URL}
                  width={32}
                  height={32}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface">
                  Nguyễn Văn Quân
                </span>
                <span className="text-[10px] text-on-surface-variant">
                  Interviewer
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-on-surface transition-colors">
              expand_more
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
