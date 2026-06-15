"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
    </header>
  );
}
