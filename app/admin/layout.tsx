// Shared layout cho toàn bộ route /admin/* (role = ADMIN).
//
// Cùng pattern với app/recruiter/layout.tsx:
//   - Server layout wrap <AdminLayoutClient>
//   - Provider là client component để tránh "Server Component cannot use createContext"
//   - Layout KHÔNG render navbar — mỗi page tự render TopNavBar + AdminSideNavBar
//     phù hợp (giống dashboard hiện hữu).

import type { Metadata } from "next";
import { AdminLayoutClient } from "./layout-client";

export const metadata: Metadata = {
  title: "Admin · NeuralCode-AI",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
