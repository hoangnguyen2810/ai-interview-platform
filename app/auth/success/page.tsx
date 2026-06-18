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

    // decode payload từ JWT
    const payload = JSON.parse(atob(token.split(".")[1]));
    const role = payload.role;

    // TopNavBar và các chỗ khác đọc role từ localStorage "user",
    // nên phải lưu lại để đồng bộ với flow login thường.
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: payload.id,
        email: payload.email,
        fullName: payload.fullName ?? "",
        role,
      }),
    );

    // Best-effort: cũng set cookie để server page (vd. /interview/*) đọc được.
    // Cookie này KHÔNG httpOnly, không dùng cho bảo mật; chỉ là fallback.
    document.cookie = `token=${encodeURIComponent(
      token,
    )}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;

    if (role === "CANDIDATE") {
      window.location.href = "/candidate/dashboard";
    } else if (role === "RECRUITER") {
      window.location.href = "/recruiter/dashboard";
    } else {
      window.location.href = "/";
    }
  }, []);

  return (
    <div className="text-white flex items-center justify-center h-screen">
      Logging in...
    </div>
  );
}
