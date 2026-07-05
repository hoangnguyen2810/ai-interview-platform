// Shared layout cho toàn bộ route /recruiter/*
//
// Quyết định kỹ thuật:
//   - Bọc `RecruiterDashboardProvider` ở đây để MỌI page con trong /recruiter
//     (dashboard, interviews, profile, recordings...) đều có thể dùng
//     `useRecruiterDashboard()` mà KHÔNG cần thêm shell/wrapper riêng.
//   - Layout này KHÔNG render navbar — mỗi page tự render nav phù hợp
//     (dashboard dùng DashboardShell wrapper, page khác dùng SideNavBar trực tiếp).
//   - Provider phải là client component → ta tách sang wrapper riêng.

import type { Metadata } from "next";
import { RecruiterLayoutClient } from "./layout-client";

export const metadata: Metadata = {
  title: "Recruiter · NeuralCode-AI",
};

export default function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RecruiterLayoutClient>{children}</RecruiterLayoutClient>;
}