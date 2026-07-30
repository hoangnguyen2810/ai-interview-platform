"use client";

import { AdminDashboardProvider } from "../components/admin-dashboard/DashboardContext";

/**
 * Client-side wrapper cho `app/admin/layout.tsx`.
 *
 * Mount provider cho mọi page con trong /admin/* — provider là no-op
 * render, giữ lại để đồng bộ pattern với recruiter area.
 */
export function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminDashboardProvider>{children}</AdminDashboardProvider>
  );
}
