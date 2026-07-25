"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChangePasswordModal } from "./ChangePasswordModal";

export function TopNavBar() {
  const [openMenu, setOpenMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      const parsed = JSON.parse(user);
      setRole(parsed?.role);
      setProvider(parsed?.provider ?? null);
    }
  }, []);

  const handleChangePassword = () => {
    setOpenMenu(false);
    setShowChangePassword(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <header className="bg-surface border-b border-outline-variant flex justify-between items-center px-margin-desktop w-full h-16 fixed top-0 z-50">
      <div className="flex items-center gap-8">
        <button
          onClick={() => {
            if (role === "CANDIDATE") {
              router.push("/candidate/dashboard");
            } else if (role === "RECRUITER") {
              router.push("/recruiter/dashboard");
            } else {
              router.push("/dashboard");
            }
          }}
          className="group relative flex items-center gap-8 cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-lg bg-cyan-500/20 blur-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <span
            className="
      relative
      font-headline-lg
      text-headline-lg
      font-black
      tracking-tight
      bg-gradient-to-r
      from-cyan-400
      via-blue-500
      to-purple-500
      bg-clip-text
      text-transparent
      transition-all
      duration-300
      group-hover:brightness-125
      group-hover:drop-shadow-[0_0_12px_rgba(34,211,238,0.7)]
    "
          >
            CodePilot AI
          </span>
        </button>
      </div>

      <div className="flex items-center gap-4 relative">
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

              {provider !== "GOOGLE" && (
                <button
                  onClick={handleChangePassword}
                  className="w-full text-left px-4 py-2 hover:bg-surface-container-high text-sm"
                >
                  Đổi mật khẩu
                </button>
              )}

              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 hover:bg-surface-container-high text-sm text-red-400"
              >
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </header>
  );
}
