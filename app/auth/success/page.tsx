"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function AuthSuccess() {
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("token");

    if (!token) return;

    // save auth
    localStorage.setItem("token", token);

    // Best-effort: cũng set cookie để server page (vd. /interview/*) đọc được.
    // Cookie này KHÔNG httpOnly, không dùng cho bảo mật; chỉ là fallback.
    document.cookie = `token=${encodeURIComponent(
      token,
    )}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;

    // JWT chỉ chứa { id, role } — không đủ để dựng "user" cho localStorage
    // (thiếu email, fullName, provider...). Gọi /api/auth/me để lấy đầy đủ,
    // đồng bộ với format user object mà flow login thường đang lưu.
    (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        const data = await res.json();

        if (!data.user) {
          window.location.href = "/login?error=google_auth_failed";
          return;
        }

        localStorage.setItem(
          "user",
          JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            fullName: data.user.fullName,
            role: data.user.role,
            provider: data.user.provider,
          }),
        );

        if (data.user.role === "CANDIDATE") {
          window.location.href = "/candidate/dashboard";
        } else if (data.user.role === "RECRUITER") {
          window.location.href = "/recruiter/dashboard";
        } else {
          window.location.href = "/";
        }
      } catch {
        window.location.href = "/login?error=google_auth_failed";
      }
    })();
  }, []);

  return (
    <div className="text-white flex items-center justify-center h-screen">
      Logging in...
    </div>
  );
}
