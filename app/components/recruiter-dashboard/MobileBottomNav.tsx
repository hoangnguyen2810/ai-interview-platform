type MobileNavItem = {
  label: string;
  icon: string;
  active?: boolean;
  ariaLabel: string;
};

const ITEMS: MobileNavItem[] = [
  { label: "Home", icon: "dashboard", active: true, ariaLabel: "Trang chủ" },
  { label: "Schedule", icon: "calendar_month", ariaLabel: "Lịch trình" },
];

const TRAILING_ITEMS: MobileNavItem[] = [
  { label: "Archive", icon: "history", ariaLabel: "Lưu trữ" },
  { label: "Profile", icon: "person", ariaLabel: "Hồ sơ" },
];

export function MobileBottomNav() {
  return (
    <nav
      aria-label="Điều hướng chính (di động)"
      className="md:hidden bg-surface-container border-t border-outline-variant flex justify-around items-center h-16 fixed bottom-0 w-full z-50"
    >
      {ITEMS.map((item) => (
        <button
          key={item.label}
          aria-label={item.ariaLabel}
          className={
            item.active
              ? "flex flex-col items-center gap-1 text-primary-fixed"
              : "flex flex-col items-center gap-1 text-on-surface-variant"
          }
          type="button"
        >
          <span className="material-symbols-outlined">{item.icon}</span>
          <span className="text-[10px] font-bold">{item.label}</span>
        </button>
      ))}
      <div className="relative -top-4">
        <button
          aria-label="Tạo buổi phỏng vấn mới"
          className="ai-gradient w-12 h-12 rounded-full flex items-center justify-center text-on-primary shadow-lg"
          type="button"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>
      {TRAILING_ITEMS.map((item) => (
        <button
          key={item.label}
          aria-label={item.ariaLabel}
          className="flex flex-col items-center gap-1 text-on-surface-variant"
          type="button"
        >
          <span className="material-symbols-outlined">{item.icon}</span>
          <span className="text-[10px]">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
