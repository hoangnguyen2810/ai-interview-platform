/**
 * `DashboardShell` giờ là no-op (layout `app/recruiter/layout.tsx` đã bọc
 * `RecruiterDashboardProvider` cho toàn bộ /recruiter/*). Giữ component này
 * để không phải refactor nhiều — chỉ trả children.
 */
export function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
