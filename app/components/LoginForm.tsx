"use client";

import { useEffect, useState } from "react";

export default function LoginForm() {
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    const redirectUri = "http://localhost:3000/api/auth/google/callback";

    const scope = ["openid", "email", "profile"].join(" ");

    const url =
      "https://accounts.google.com/o/oauth2/v2/auth" +
      `?client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent`;

    window.location.href = url;
  };

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  useEffect(() => {
    const inputs = document.querySelectorAll("input");

    inputs.forEach((input) => {
      const wrapper = input.closest(".input-wrapper");

      input.addEventListener("focus", () => {
        wrapper?.classList.add("scale-[1.01]");
      });

      input.addEventListener("blur", () => {
        wrapper?.classList.remove("scale-[1.01]");
      });
    });

    return () => {};
  }, []);
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Đăng nhập thất bại");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      const role = data.user?.role;

      // 🔥 điều hướng theo role
      switch (role) {
        case "CANDIDATE":
          window.location.href = "/candidate/dashboard";
          break;

        case "RECRUITER":
          window.location.href = "/recruiter/dashboard";
          break;

        case "ADMIN":
          window.location.href = "/admin/dashboard";
          break;

        default:
          window.location.href = "/";
          break;
      }
    } catch {
      setError("Không thể kết nối tới máy chủ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#051424] text-[#d4e4fa] overflow-hidden relative">
      {/* BACKGROUND EFFECT */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00f0ff]/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#571bc1]/10 blur-[120px]" />
      </div>

      {/* MAIN */}
      <main className="relative z-10 w-full max-w-[480px] px-4">
        {/* BRAND */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4 w-16 h-16 flex items-center justify-center rounded-xl bg-[#122131] border border-[#3b494b]">
            <span className="text-3xl">🧠</span>
          </div>

          <h1 className="text-[36px] font-bold tracking-tighter text-[#dbfcff]">
            NeuralCode AI
          </h1>
        </div>

        {/* CARD */}
        <div className="glass-panel rounded-3xl p-8 border border-[#3b494b] shadow-2xl">
          {/* TITLE */}
          <div className="text-center mb-8">
            <h2 className="text-[28px] font-semibold mb-2">
              Chào mừng trở lại
            </h2>
            <p className="text-[#b9cacb]">
              Tiếp tục hành trình lập trình cùng AI
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* EMAIL */}
            <div className="space-y-2 input-wrapper transition-transform">
              <label className="text-[12px] text-[#b9cacb]">Email</label>

              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#849495] group-focus-within:text-[#00f0ff] transition">
                  mail
                </span>

                <input
                  type="email"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      email: e.target.value,
                    })
                  }
                  className="w-full bg-[#051424] border border-[#3b494b]
  rounded-xl py-3 pl-12 pr-4 outline-none
  focus:border-[#00f0ff]"
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className="space-y-2 input-wrapper transition-transform">
              <div className="flex justify-between px-1">
                <label className="text-[12px] text-[#b9cacb]">Mật khẩu</label>
                <a className="text-[12px] text-[#00f0ff] hover:underline">
                  Quên mật khẩu?
                </a>
              </div>

              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#849495] group-focus-within:text-[#00f0ff] transition">
                  lock
                </span>

                <input
                  type={showPass ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      password: e.target.value,
                    })
                  }
                  placeholder="••••••••"
                  className="w-full bg-[#051424] border border-[#3b494b]
  rounded-xl py-3 pl-12 pr-12 outline-none
  focus:border-[#00f0ff]"
                />

                <button
                  type="button"
                  onClick={() => setShowPass((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
  w-7 h-7 flex items-center justify-center
  rounded-md bg-[#122131] border border-[#3b494b]
  text-[#849495] hover:text-[#00f0ff] hover:border-[#00f0ff]
  transition"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPass ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* CHECKBOX */}
            <label className="flex items-center gap-3 text-[12px] text-[#b9cacb]">
              <input type="checkbox" className="w-4 h-4" />
              Duy trì đăng nhập
            </label>
            {error && (
              <div
                className="
      rounded-xl
      border border-red-500/30
      bg-red-500/10
      px-4 py-3
      text-sm
      text-red-300
    "
              >
                {error}
              </div>
            )}
            {/* BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="
    w-full py-4 rounded-xl
    bg-[#00f0ff]
    text-[#00363a]
    font-bold
    shadow-[0_0_20px_rgba(0,240,255,0.3)]
    hover:brightness-110
    active:scale-95
    transition
    disabled:opacity-50
    disabled:cursor-not-allowed
  "
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            {/* DIVIDER */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[#3b494b]/30" />
              <span className="text-[12px] text-[#b9cacb]">Hoặc</span>
              <div className="flex-1 h-px bg-[#3b494b]/30" />
            </div>

            {/* GOOGLE */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3
  py-3 rounded-xl bg-[#122131] border border-[#3b494b]
  hover:bg-[#273647]/50 transition"
            >
              {/* Google Logo */}
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.1 0 5.9 1.1 8.1 3.2l6-6C34.9 3.1 29.8 1 24 1 14.6 1 6.7 6.4 2.7 14.1l7 5.4C11.6 13 17.3 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3.1-2.4 5.7-5 7.4l7.8 6c4.6-4.3 7-10.7 7-17.9z"
                />
                <path
                  fill="#FBBC05"
                  d="M9.7 28.5c-1-2.9-1-6.1 0-9L2.7 14.1C.9 17.5 0 21.6 0 25.9s.9 8.4 2.7 11.8l7-5.4z"
                />
                <path
                  fill="#34A853"
                  d="M24 47c6.5 0 12-2.1 16-5.7l-7.8-6c-2.2 1.5-5 2.4-8.2 2.4-6.7 0-12.4-4.5-14.3-10.6l-7 5.4C6.7 41.6 14.6 47 24 47z"
                />
              </svg>

              <span>Tiếp tục với Google</span>
            </button>
          </form>

          {/* FOOTER */}
          <div className="mt-10 text-center">
            <p className="text-[#b9cacb] text-[12px]">
              Chưa có tài khoản?{" "}
              <a className="text-[#00f0ff] hover:underline" href="/register">
                Đăng ký ngay
              </a>
            </p>
          </div>
        </div>

        {/* BOTTOM INFO */}
        <div className="mt-8 flex justify-center gap-6 text-[11px] text-[#849495]">
          <span>🔒 SECURE AES-256</span>
          <span>⚡ AI POWERED</span>
        </div>
      </main>
    </div>
  );
}
