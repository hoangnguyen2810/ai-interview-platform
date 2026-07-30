"use client";

import type { ReactNode } from "react";
import { TopNavBar } from "@/app/components/TopNavBar";
import { AdminSideNavBar } from "@/app/components/admin-dashboard/AdminSideNavBar";

/**
 * Shell chuẩn cho mọi admin page.
 * Render TopNavBar + AdminSideNavBar + main; các page chỉ cần
 * đặt nội dung vào <main>.
 *
 * Không tự check role — page caller dùng useAdminGuard() trước.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <>
      <TopNavBar />
      <div className="flex pt-16 h-screen overflow-hidden">
        <AdminSideNavBar />
        <main className="flex-grow md:ml-sidebar-width overflow-y-auto custom-scrollbar bg-background p-6 md:p-margin-desktop pb-24 md:pb-margin-desktop">
          {children}
        </main>
      </div>
    </>
  );
}
