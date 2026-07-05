"use client";

import { RecruiterDashboardProvider } from "../components/recruiter-dashboard/DashboardContext";

/**
 * Client-side wrapper cho `app/recruiter/layout.tsx`.
 *
 * Tách riêng để tránh Next.js báo lỗi "Server Component cannot use createContext":
 *   - `layout.tsx` (server) chỉ nhận children + metadata
 *   - component này là "use client" → mount provider cho mọi page con
 *
 * Provider là no-op render nên không ảnh hưởng tới UI hiện tại.
 */
export function RecruiterLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RecruiterDashboardProvider>{children}</RecruiterDashboardProvider>
  );
}