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
        href: "/admin/dashboard",
      },
    ],
  },
  {
    title: "Quản lý",
    items: [
      { label: "Người dùng", icon: "group", href: "/admin/users" },
      {
        label: "Buổi phỏng vấn",
        icon: "calendar_today",
        href: "/admin/interviews",
      },
      {
        label: "Tin nhắn",
        icon: "chat",
        href: "/admin/messages",
      },
      {
        label: "Báo cáo đánh giá",
        icon: "analytics",
        href: "/admin/reports",
      },
      {
        label: "Bản ghi hình",
        icon: "video_library",
        href: "/admin/recordings",
      },
    ],
  },
  {
    title: "Kho nội dung",
    items: [
      {
        label: "Câu hỏi lập trình",
        icon: "code",
        href: "/admin/questions",
      },
      {
        label: "Test case AI",
        icon: "science",
        href: "/admin/ai-test-cases",
      },
      {
        label: "AI Review",
        icon: "auto_awesome",
        href: "/admin/ai-reviews",
      },
    ],
  },
];

export function AdminSideNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      const parsed = JSON.parse(user);
      setRole(parsed?.role);
    }
  }, []);

  const handleGoDashboard = () => {
    if (role === "ADMIN") {
      router.push("/admin/dashboard");
    } else if (role === "RECRUITER") {
      router.push("/recruiter/dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <aside className="bg-surface-container-lowest border-r border-outline-variant flex flex-col h-full w-sidebar-width fixed left-0 top-16 bottom-0 hidden md:flex z-40">
      <div className="flex flex-col h-full">
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
              "
            >
              CodePilot AI
            </span>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto px-2 space-y-6 custom-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <h3 className="px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                {group.title}
              </h3>

              {group.items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
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
      </div>
    </aside>
  );
}
