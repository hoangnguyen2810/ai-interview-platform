"use client";

import { useState } from "react";

export default function RegisterForm() {
  const [showPass, setShowPass] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "CANDIDATE",
  });

  const getPasswordStrength = (password: string) => {
    let score = 0;

    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    return score;
  };

  const strength = getPasswordStrength(formData.password);
  const strengthLabels = [
    "Rất yếu",
    "Yếu",
    "Trung bình",
    "Khá",
    "Mạnh",
    "Rất mạnh",
  ];
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!acceptTerms) {
      alert("Vui lòng đồng ý với Điều khoản và Chính sách trước khi đăng ký.");
      return;
    }
    try {
      setLoading(true);

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message);
        return;
      }

      alert("Đăng ký thành công");

      window.location.href = "/login";
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex items-stretch bg-[#051424] text-[#d4e4fa] overflow-x-hidden">
      {/* LEFT PANEL */}
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#0d1c2d] items-center justify-center border-r border-[#3b494b]">
        <div className="relative z-10 p-12 max-w-xl text-center">
          {/* ICON GLASS */}
          <div
            className="mb-8 inline-flex items-center justify-center p-4 rounded-xl
            bg-[rgba(15,23,42,0.8)] border border-[rgba(30,41,59,0.5)] shadow-lg"
          >
            <span className="text-5xl">🧠</span>
          </div>

          {/* TITLE */}
          <h1 className="text-[36px] font-bold leading-tight tracking-tighter mb-6">
            Nâng tầm{" "}
            <span className="bg-gradient-to-r from-[#dbfcff] to-[#d0bcff] bg-clip-text text-transparent">
              Tư duy Lập trình
            </span>{" "}
            cùng AI
          </h1>

          {/* DESC */}
          <p className="text-[#b9cacb] leading-relaxed">
            Hệ thống phỏng vấn thông minh sử dụng NeuralCode AI để phân tích
            logic, tối ưu cú pháp và hỗ trợ ứng viên đạt tiềm năng tối đa.
          </p>

          {/* TERMINAL */}
          <div className="mt-12 glass-panel p-6 rounded-xl border border-[#3b494b] text-left font-mono text-[12px] shadow-2xl">
            <div className="flex gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
            </div>

            <p>
              <span className="text-[#00dbe9]">const</span> neuralAssistant ={" "}
              <span className="text-[#d8e3fb]">new</span> NeuralAI();
            </p>

            <p className="text-[#b9cacb]">
              neuralAssistant.analyze(candidate_logic);
            </p>

            <p className="text-[#00f0ff] animate-pulse">
              &gt;&gt; [AI]: Suggesting optimization for O(n)
            </p>

            <p className="text-[#b9cacb]">_</p>
          </div>
        </div>
      </aside>

      {/* RIGHT PANEL */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12 lg:p-24 bg-[#051424]">
        <div className="w-full max-w-[480px]">
          {/* HEADER */}
          <header className="mb-10 text-center">
            <h1 className="text-[40px] font-bold tracking-tighter mb-4">
              <span
                className="bg-gradient-to-r from-[#00f0ff] via-[#dbfcff] to-[#d0bcff]
      bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(0,219,233,0.3)]"
              >
                NeuralAI Code
              </span>
            </h1>
            <h2 className="text-[28px] font-semibold text-[#d4e4fa] mb-2">
              Bắt đầu hành trình của bạn
            </h2>
            <p className="text-[#b9cacb]">
              Tham gia cộng đồng kỹ sư tài năng nhất ngay hôm nay.
            </p>
          </header>

          <form onSubmit={handleRegister} className="space-y-6">
            {/* ROLE SELECT (FIXED peer system) */}
            <div className="grid grid-cols-2 gap-4">
              {/* Candidate */}
              <label className="cursor-pointer group">
                <input
                  type="radio"
                  name="role"
                  checked={formData.role === "CANDIDATE"}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      role: "CANDIDATE",
                    })
                  }
                  className="peer hidden"
                />

                <div
                  className="flex flex-col items-center p-4 rounded-xl border border-[#3b494b]
                  transition-all duration-200
                  group-hover:bg-[#273647]/40
                  peer-checked:border-[#00dbe9]
                  peer-checked:bg-[#273647]/30"
                >
                  <span className="text-[#b9cacb] group-hover:text-[#d4e4fa]">
                    💻
                  </span>
                  <span className="text-[12px] mt-2">Ứng viên</span>
                </div>
              </label>

              {/* Interviewer */}
              <label className="cursor-pointer group">
                <input
                  type="radio"
                  name="role"
                  checked={formData.role === "RECRUITER"}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      role: "RECRUITER",
                    })
                  }
                  className="peer hidden"
                />

                <div
                  className="flex flex-col items-center p-4 rounded-xl border border-[#3b494b]
                  transition-all duration-200
                  group-hover:bg-[#273647]/40
                  peer-checked:border-[#00dbe9]
                  peer-checked:bg-[#273647]/30"
                >
                  <span className="text-[#b9cacb]">🏢</span>
                  <span className="text-[12px] mt-2">Nhà tuyển dụng</span>
                </div>
              </label>
            </div>

            {/* INPUTS */}
            <div>
              <label className="text-[12px] text-[#b9cacb]">Họ và tên</label>
              <input
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    fullName: e.target.value,
                  })
                }
                className="w-full mt-2 p-3 rounded-lg bg-[#122131]
  border border-[#3b494b] focus:border-[#00f0ff] outline-none"
                placeholder="Nguyễn Văn A"
              />
            </div>

            <div>
              <label className="text-[12px] text-[#b9cacb]">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    email: e.target.value,
                  })
                }
                className="w-full mt-2 p-3 rounded-lg bg-[#122131]
  border border-[#3b494b] focus:border-[#00f0ff] outline-none"
                placeholder="example@neuralcode.ai"
              />
            </div>

            {/* PASSWORD */}
            <div>
              <label className="text-[12px] text-[#b9cacb]">Mật khẩu</label>

              <div className="relative mt-2">
                <input
                  type={showPass ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      password: e.target.value,
                    })
                  }
                  className="w-full p-3 rounded-lg bg-[#122131]
  border border-[#3b494b] focus:border-[#00f0ff] outline-none"
                  placeholder="••••••••"
                />

                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-3 text-[#b9cacb]"
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>

              {/* STRENGTH BAR */}
              <div className="flex gap-1 mt-2 h-1">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div
                    key={item}
                    className={`flex-1 rounded ${
                      strength >= item ? "bg-[#00f0ff]" : "bg-[#273647]"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between mt-2 gap-4">
                <span className="text-[11px] text-[#b9cacb]">
                  Độ mạnh mật khẩu
                </span>

                <span className="shrink-0 text-[11px] font-semibold text-[#00f0ff]">
                  {strengthLabels[strength]}
                </span>
              </div>
            </div>

            {/* TERMS */}
            <label className="flex w-full items-start gap-3 text-[12px] text-[#b9cacb] mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1.5 h-4 w-4 shrink-0 accent-[#00f0ff]"
              />

              <span className="leading-5 w-full">
                Tôi đồng ý với{" "}
                <a href="/terms" className="text-[#00dbe9] hover:underline">
                  Điều khoản sử dụng
                </a>{" "}
                và{" "}
                <a href="/privacy" className="text-[#00dbe9] hover:underline">
                  Chính sách bảo mật
                </a>
              </span>
            </label>

            {/* BUTTON */}
            <button
              type="submit"
              disabled={loading || !acceptTerms}
              className="w-full py-4 rounded-xl bg-[#00f0ff]
  text-[#00363a] font-bold
  shadow-[0_0_15px_rgba(0,219,233,0.3)]
  hover:brightness-110
  active:scale-95
  transition
  disabled:opacity-50
  disabled:cursor-not-allowed"
            >
              {loading ? "Đang đăng ký..." : "Đăng ký tài khoản"}
            </button>
          </form>

          {/* FOOTER */}
          <p className="text-center mt-8 text-[12px] text-[#b9cacb]">
            Đã có tài khoản?{" "}
            <a className="text-[#00dbe9]" href="/login">
              Đăng nhập
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
