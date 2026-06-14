"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const NAV_LINKS = [
  { label: "Interview", href: "#" },
  { label: "Dashboard", href: "#", active: true },
  { label: "Archive", href: "#" },
];

export function TopNavBar() {
  const [openMenu, setOpenMenu] = useState(false);
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      const parsed = JSON.parse(user);
      setRole(parsed?.role);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <header className="bg-surface border-b border-outline-variant flex justify-between items-center px-margin-desktop w-full h-16 fixed top-0 z-50">
      <div className="flex items-center gap-8">
        <span className="font-headline-lg text-headline-lg font-black text-primary-fixed tracking-tight">
          NeuralCode AI
        </span>

        <nav className="hidden md:flex gap-6">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              className={
                link.active
                  ? "font-body-md text-body-md text-primary-fixed border-b-2 border-primary-fixed pb-1"
                  : "font-body-md text-body-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors px-2 py-1"
              }
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-4 relative">
        {/* SEARCH */}
        <div className="relative hidden lg:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
            search
          </span>
          <input
            className="bg-surface-container border border-outline-variant rounded-full pl-10 pr-4 py-1.5 text-sm focus:ring-1 focus:ring-primary-fixed outline-none w-64"
            placeholder="Tìm kiếm ứng viên..."
          />
        </div>

        {/* NOTI */}
        <button className="material-symbols-outlined text-on-surface-variant hover:text-primary-fixed p-2">
          notifications
        </button>

        {/* SETTINGS */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu((prev) => !prev)}
            className="material-symbols-outlined text-on-surface-variant hover:text-primary-fixed p-2 rounded-full"
          >
            settings
          </button>

          {/* DROPDOWN */}
          {openMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-surface border border-outline-variant rounded-xl shadow-lg overflow-hidden">
              <button
                onClick={() => {
                  if (role === "CANDIDATE") {
                    router.push("/candidate/profile");
                  } else if (role === "RECRUITER") {
                    router.push("/recruiter/profile");
                  } else {
                    router.push("/profile");
                  }

                  setOpenMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-surface-container-high text-sm"
              >
                Trang cá nhân
              </button>

              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 hover:bg-surface-container-high text-sm text-red-400"
              >
                Đăng xuất
              </button>
            </div>
          )}
        </div>

        {/* AVATAR */}
        <Image
          alt="avatar"
          className="w-8 h-8 rounded-full border border-primary-fixed object-cover"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCSpTS4TcvgRo-5gFUy0QNjo0qcafkU-u-vhMh3b3_-ZYIrTK54Yx4M4Co2A4xSsEupm9_fQ1ctdSWSqV1QpYTLCqMjVQX-d4l0NcB3bPrwtaw0TnvaGaQPligilB1VTbB3vjzX5FwJp_-nXyhdueUYOJ_3WVZgDeOUoXBhwlTunGQhbm0VkhtiADRb-H2Fxmvlxg6L8JDzQZuJ2U2FkB6mBpaK-Ver6tyETXUwdBKIh5_msB5P45muwzBk-3X1mlisFisNfBOZx_8"
          width={32}
          height={32}
        />
      </div>
    </header>
  );
}
