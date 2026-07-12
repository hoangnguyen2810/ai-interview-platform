"use client";

import { BriefcaseBusiness, Eye, EyeOff, User } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

export default function RegisterForm() {
  const [showPass, setShowPass] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "CANDIDATE",
  });

  const [errorModal, setErrorModal] = useState({
    open: false,
    title: "",
    message: "",
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!acceptTerms) {
      setErrorModal({
        open: true,
        title: "Thiếu xác nhận",
        message:
          "Vui lòng đồng ý với Điều khoản sử dụng và Chính sách bảo mật trước khi đăng ký.",
      });
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
        setErrorModal({
          open: true,
          title: "Đăng ký thất bại",
          message: data.message,
        });
        return;
      }

      setShowSuccessModal(true);
    } catch (error) {
      console.error(error);
      setErrorModal({
        open: true,
        title: "Lỗi hệ thống",
        message: "Đã xảy ra lỗi trong quá trình đăng ký. Vui lòng thử lại sau.",
      });
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
            <span className="text-5xl">
              <Image
                src="/favicon.ico"
                alt="CodePilot AI"
                width={48}
                height={48}
                priority
              />
            </span>
          </div>

          {/* TITLE */}
          <h1 className="text-[36px] font-bold leading-tight tracking-tighter mb-6">
            Nền tảng Phỏng vấn Thông minh cùng AI
          </h1>

          {/* DESC */}
          <p className="text-[#b9cacb] leading-relaxed">
            Hệ thống phỏng vấn thông minh sử dụng AI để phân tích logic, tối ưu
            cú pháp và hỗ trợ ứng viên đạt tiềm năng tối đa.
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
              <span className="text-[#d8e3fb]">new</span> CodePilot AI();
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
                CodePilot AI
              </span>
            </h1>
            <h2 className="text-[28px] font-semibold text-[#d4e4fa] mb-2">
              Bắt đầu buổi phỏng vấn của bạn
            </h2>
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
                  <User
                    size={26}
                    className="
        text-[#849495]
        transition-all duration-300
        group-hover:text-cyan-300
        peer-checked:text-[#00dbe9]
      "
                  />

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
                  <BriefcaseBusiness
                    size={26}
                    className="
        text-[#849495]
        transition-all duration-300
        group-hover:text-cyan-300
      "
                  />

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
                placeholder="example@codepilot.ai"
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
                  className="
    absolute right-3 top-1/2 -translate-y-1/2
    w-8 h-8
    flex items-center justify-center
    rounded-lg
    bg-[#122131]
    border border-[#3b494b]
    text-[#849495]
    transition-all duration-300
    hover:text-[#00f0ff]
    hover:border-[#00f0ff]
    hover:bg-[#17324d]
  "
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
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
            <div className="flex justify-center mt-6">
              <label className="flex max-w-md items-center gap-3 text-[12px] text-[#b9cacb] cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-[#00f0ff]"
                />

                <span className="leading-5">
                  Tôi đồng ý với{" "}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-[#00dbe9] transition-all duration-300 cursor-pointer hover:text-white  hover:drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]"
                  >
                    Điều khoản sử dụng
                  </button>{" "}
                  và{" "}
                  <button
                    type="button"
                    onClick={() => setShowPrivacyModal(true)}
                    className="text-[#00dbe9] transition-all duration-300 cursor-pointer hover:text-white hover:drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]"
                  >
                    Chính sách bảo mật
                  </button>
                </span>
              </label>
            </div>

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
            <a
              className="
          text-[#00dbe9]
          transition-all duration-300
          hover:text-white
          hover:drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]
        "
              href="/login"
            >
              Đăng nhập
            </a>
          </p>
        </div>
      </main>
      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="
      w-[420px]
      rounded-2xl
      border border-cyan-500/30
      bg-[#0d1c2d]
      p-8
      text-center
      shadow-[0_0_40px_rgba(0,240,255,0.15)]
      animate-in fade-in zoom-in duration-300
    "
          >
            {/* Icon */}
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cyan-500/15 border border-cyan-400/30">
              <svg
                className="h-10 w-10 text-cyan-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h2 className="mt-6 text-2xl font-bold text-white">
              Đăng ký thành công
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#b9cacb]">
              Tài khoản của bạn đã được tạo thành công.
              <br />
              Hãy đăng nhập để bắt đầu sử dụng CodePilot AI.
            </p>

            <button
              onClick={() => {
                setShowSuccessModal(false);
                window.location.href = "/login";
              }}
              className="
          mt-8
          w-full
          rounded-xl
          bg-[#00f0ff]
          py-3
          font-semibold
          text-[#00363a]
          transition
          hover:brightness-110
        "
            >
              Đi tới đăng nhập
            </button>
          </div>
        </div>
      )}

      {errorModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            className="
      w-[430px]
      rounded-2xl
      border border-red-500/30
      bg-[#0d1c2d]
      p-8
      text-center
      shadow-[0_0_40px_rgba(239,68,68,0.2)]
      animate-in fade-in zoom-in duration-300
    "
          >
            {/* Icon */}
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
              <svg
                className="h-10 w-10 text-red-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v4m0 4h.01M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z"
                />
              </svg>
            </div>

            <h2 className="mt-6 text-2xl font-bold text-white">
              {errorModal.title}
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#b9cacb]">
              {errorModal.message}
            </p>

            <button
              onClick={() =>
                setErrorModal({
                  open: false,
                  title: "",
                  message: "",
                })
              }
              className="
        mt-8
        w-full
        rounded-xl
        bg-red-500
        py-3
        font-semibold
        text-white
        transition
        hover:bg-red-400
      "
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center custom-scrollbar justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-cyan-500/20 bg-[#0d1c2d] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#233445] px-6 py-4">
              <h2 className="text-xl font-bold text-white">
                Điều khoản sử dụng
              </h2>

              <button
                onClick={() => setShowTermsModal(false)}
                className="text-2xl text-[#b9cacb] hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto px-6 py-5 space-y-5 text-sm leading-7 text-[#b9cacb]">
              <div>
                <h3 className="mb-2 text-white font-semibold">
                  1. Chấp nhận điều khoản
                </h3>

                <p>
                  Khi đăng ký tài khoản và sử dụng CodePilot AI, bạn đồng ý tuân
                  thủ toàn bộ điều khoản được quy định trong tài liệu này.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-white font-semibold">
                  2. Sử dụng tài khoản
                </h3>

                <ul className="list-disc pl-6 space-y-2">
                  <li>Không chia sẻ tài khoản cho người khác.</li>
                  <li>Không sử dụng hệ thống vào mục đích trái pháp luật.</li>
                  <li>
                    Không cố gắng khai thác lỗ hổng hoặc tấn công hệ thống.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-white font-semibold">
                  3. Nội dung phỏng vấn
                </h3>

                <p>
                  Các buổi phỏng vấn có thể được ghi âm hoặc ghi hình nhằm phục
                  vụ đánh giá AI và cải thiện chất lượng hệ thống.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-white font-semibold">
                  4. Quyền của hệ thống
                </h3>

                <p>
                  CodePilot AI có quyền khóa hoặc đình chỉ tài khoản nếu phát
                  hiện hành vi gian lận hoặc vi phạm điều khoản.
                </p>
              </div>
            </div>

            <div className="border-t border-[#233445] p-5">
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-full rounded-xl bg-cyan-400 py-3 font-semibold text-[#04212d] hover:brightness-110"
              >
                Tôi đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center custom-scrollbar justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-cyan-500/20 bg-[#0d1c2d] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#233445] px-6 py-4">
              <h2 className="text-xl font-bold text-white">
                Chính sách bảo mật
              </h2>

              <button
                onClick={() => setShowPrivacyModal(false)}
                className="text-2xl text-[#b9cacb] hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto px-6 py-5 space-y-5 text-sm leading-7 text-[#b9cacb]">
              <div>
                <h3 className="mb-2 text-white font-semibold">
                  Thông tin thu thập
                </h3>

                <ul className="list-disc pl-6 space-y-2">
                  <li>Họ và tên.</li>
                  <li>Email.</li>
                  <li>Vai trò người dùng.</li>
                  <li>Dữ liệu phỏng vấn.</li>
                  <li>Video và âm thanh (nếu được ghi).</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-white font-semibold">
                  Mục đích sử dụng
                </h3>

                <ul className="list-disc pl-6 space-y-2">
                  <li>Xác thực người dùng.</li>
                  <li>Đánh giá kết quả phỏng vấn.</li>
                  <li>Huấn luyện và cải thiện AI.</li>
                  <li>Nâng cao chất lượng dịch vụ.</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-white font-semibold">
                  Bảo mật dữ liệu
                </h3>

                <p>
                  Dữ liệu được lưu trữ an toàn. Chúng tôi không chia sẻ thông
                  tin cá nhân cho bên thứ ba nếu không có sự đồng ý của bạn, trừ
                  trường hợp pháp luật yêu cầu.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-white font-semibold">
                  Quyền của người dùng
                </h3>

                <ul className="list-disc pl-6 space-y-2">
                  <li>Yêu cầu chỉnh sửa thông tin.</li>
                  <li>Yêu cầu xóa tài khoản.</li>
                  <li>Yêu cầu xóa dữ liệu phỏng vấn.</li>
                </ul>
              </div>
            </div>

            <div className="border-t border-[#233445] p-5">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="w-full rounded-xl bg-cyan-400 py-3 font-semibold text-[#04212d] hover:brightness-110"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
