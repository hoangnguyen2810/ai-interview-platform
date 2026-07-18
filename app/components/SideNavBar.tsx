"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = {
  label: string;
  icon: string;
  href: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Tổng quan",
    items: [
      {
        label: "Trang chủ",
        icon: "dashboard",
        href: "/recruiter/dashboard",
      },
    ],
  },
  {
    title: "Phỏng vấn",
    items: [
      {
        label: "Lịch phỏng vấn",
        icon: "calendar_today",
        href: "/recruiter/interviews",
      },
    ],
  },
  {
    title: "Báo cáo",
    items: [
      {
        label: "Các báo cáo ứng viên",
        icon: "analytics",
        href: "/recruiter/reports",
      },
    ],
  },
  {
    title: "Lưu trữ",
    items: [
      {
        label: "Các buổi ghi hình",
        icon: "video_library",
        href: "/recruiter/recordings",
      },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      {
        label: "Hồ sơ cá nhân",
        icon: "help",
        href: "/recruiter/profile",
      },
      {
        label: "Cài đặt",
        icon: "settings",
        href: "#",
      },
    ],
  },
];

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCSpTS4TcvgRo-5gFUy0QNjo0qcafkU-u-vhMh3b3_-ZYIrTK54Yx4M4Co2A4xSsEupm9_fQ1ctdSWSqV1QpYTLCqMjVQX-d4l0NcB3bPrwtaw0TnvaGaQPligilB1VTbB3vjzX5FwJp_-nXyhdueUYOJ_3WVZgDeOUoXBhwlTunGQhbm0VkhtiADRb-H2Fxmvlxg6L8JDzQZuJ2U2FkB6mBpaK-Ver6tyETXUwdBKIh5_msB5P45muwzBk-3X1mlisFisNfBOZx_8";

export function SideNavBar() {
  const [role, setRole] = useState<string | null>(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [language, setLanguage] = useState("vi");

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const user = localStorage.getItem("user");

    if (user) {
      const parsed = JSON.parse(user);
      setRole(parsed?.role);
    }
    const savedLanguage = localStorage.getItem("language");

    if (savedLanguage) {
      setLanguage(savedLanguage);
    }
  }, []);

  const handleChangeLanguage = (lang: "vi" | "en") => {
    setLanguage(lang);
    localStorage.setItem("language", lang);

    // reload để các component đọc lại language
    window.location.reload();
  };

  const handleGoDashboard = () => {
    if (role === "CANDIDATE") {
      router.push("/candidate/dashboard");
    } else if (role === "RECRUITER") {
      router.push("/recruiter/dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <aside className="bg-surface-container-lowest border-r border-outline-variant flex flex-col h-full w-sidebar-width fixed left-0 top-16 bottom-0 hidden md:flex z-40">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="px-4 py-6 mb-2">
          <button
            onClick={handleGoDashboard}
            className="group flex items-center gap-3 cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <div className="w-8 h-8 flex items-center justify-center">
              <img
                src="/favicon.ico"
                alt="CodePilot AI"
                className="w-full h-full object-contain"
              />
            </div>

            <span
              className="
                text-lg
                font-black
                tracking-tight
                leading-none
                bg-gradient-to-r
                from-cyan-400
                via-blue-500
                to-indigo-500
                bg-clip-text
                text-transparent
                transition-all
                duration-300
                group-hover:drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]
              "
            >
              CodePilot AI
            </span>
          </button>
        </div>

        {/* Menu */}
        <div className="flex-grow overflow-y-auto px-2 space-y-6 custom-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <h3 className="px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                {group.title}
              </h3>

              {group.items.map((item) => {
                const isActive =
                  item.href !== "/"
                    ? pathname.startsWith(item.href)
                    : pathname === item.href;

                return item.label === "Cài đặt" ? (
                  <button
                    key={item.label}
                    onClick={() => setShowLanguageModal(true)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-primary-fixed hover:bg-surface-container-highest rounded-lg transition-all"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {item.icon}
                    </span>

                    <span className="font-label-sm text-label-sm">
                      {item.label}
                    </span>
                  </button>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={
                      isActive
                        ? "flex items-center gap-3 px-4 py-2.5 bg-secondary-container text-on-secondary-container rounded-lg shadow-[0_0_15px_rgba(87,27,193,0.3)] transition-all"
                        : "flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-primary-fixed hover:bg-surface-container-highest rounded-lg transition-all"
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {item.icon}
                    </span>

                    <span className="font-label-sm text-label-sm">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* User */}

        <span className="material-symbols-outlined text-on-surface-variant group-hover:text-on-surface transition-colors">
          expand_more
        </span>
      </div>
      {showLanguageModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="w-[360px] rounded-2xl bg-surface-container p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-on-surface">
              Chọn ngôn ngữ
            </h2>

            <p className="mt-1 text-sm text-on-surface-variant">
              Language / Ngôn ngữ
            </p>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => handleChangeLanguage("vi")}
                className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                  language === "vi"
                    ? "border-cyan-500 bg-cyan-500/15"
                    : "border-outline-variant hover:bg-surface-container-high"
                }`}
              >
                🇻🇳 Tiếng Việt
              </button>

              <button
                onClick={() => handleChangeLanguage("en")}
                className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                  language === "en"
                    ? "border-cyan-500 bg-cyan-500/15"
                    : "border-outline-variant hover:bg-surface-container-high"
                }`}
              >
                🇺🇸 English
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowLanguageModal(false)}
                className="rounded-lg px-4 py-2 hover:bg-surface-container-high"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
