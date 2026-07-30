"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

/**
 * AdminDashboardProvider — no-op, giữ lại để đồng bộ pattern với recruiter.
 * Mở rộng nếu cần publish/subscribe events giữa các trang admin.
 */
export function AdminDashboardProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAdminDashboard() {
  // Trả về no-op object nếu sau này cần dùng thì mở rộng ở đây.
  // Hiện tại chỉ là marker để phân biệt vùng admin.
  return {};
}

const AdminMarkerContext = createContext<boolean>(false);

export function AdminMarkerProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AdminMarkerContext.Provider value={true}>
      {children}
    </AdminMarkerContext.Provider>
  );
}

export function useAdminMarker() {
  return useContext(AdminMarkerContext);
}
