"use client";

import { RecruiterDashboardProvider } from "./DashboardContext";

export function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RecruiterDashboardProvider>{children}</RecruiterDashboardProvider>;
}
