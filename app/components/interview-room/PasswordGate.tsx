"use client";

import { useState, type FormEvent } from "react";

interface PasswordGateProps {
  meetingCode: string;
  title: string;
  /** Trang đích sau khi verify — dùng để "refresh" trang hiện tại */
  redirectPath: string;
}

/**
 * Form nhập password phòng phỏng vấn.
 * - Gọi POST /api/interviews/[code]/verify-password
 * - Server bcrypt.compare → set cookie gate nếu đúng
 * - Sau khi đúng, router.refresh() để server re-render lại page đích
 *   (KHÔNG reload window, KHÔNG redirect dashboard)
 * - Sai → show error inline, không redirect
 */
export default function PasswordGate({
  meetingCode,
  title,
  redirectPath,
}: PasswordGateProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/verify-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );

      const data: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "message" in data &&
          typeof (data as { message?: unknown }).message === "string"
            ? (data as { message: string }).message
            : "Mật khẩu không đúng";
        setError(msg);
        setLoading(false);
        return;
      }

      // Verify thành công → refresh server component để guard pass
      // Dùng redirect về chính path hiện tại để re-render server-side
      window.location.assign(redirectPath);
    } catch {
      setError("Lỗi mạng, vui lòng thử lại");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#051424] px-4">
      <form
        onSubmit={handleSubmit}
        className="
          w-full max-w-md
          p-8
          rounded-2xl
          bg-[#0d1c2d]
          border border-[#23384d]
          shadow-[0_0_30px_rgba(0,240,255,0.08)]
          flex flex-col gap-5
        "
      >
        <div className="flex items-center gap-3">
          <div
            className="
              w-12 h-12
              rounded-xl
              bg-gradient-to-br
              from-cyan-500
              to-blue-600
              flex items-center justify-center
              shadow-[0_0_20px_rgba(0,240,255,0.4)]
            "
          >
            <span className="material-symbols-outlined text-white text-2xl">
              lock
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-cyan-200">
              Phòng được bảo vệ
            </h1>
            <p className="text-sm text-gray-400">
              Nhập mật khẩu để vào phòng phỏng vấn
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            Phòng
          </p>
          <p className="text-sm text-white font-semibold truncate">{title}</p>
          <p className="text-xs text-cyan-300 font-mono tracking-widest">
            {meetingCode}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="room-password"
            className="text-sm text-gray-300"
          >
            Mật khẩu phòng
          </label>
          <input
            id="room-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="off"
            autoFocus
            placeholder="••••••••"
            className="
              w-full
              px-4 py-3
              rounded-lg
              bg-[#122131]
              border border-[#3b494b]
              text-white
              placeholder-gray-600
              focus:outline-none
              focus:border-cyan-400
              focus:shadow-[0_0_12px_rgba(0,240,255,0.3)]
              transition-all
              disabled:opacity-50
            "
          />
        </div>

        {error && (
          <div
            role="alert"
            className="
              flex items-center gap-2
              px-3 py-2
              rounded-lg
              bg-red-500/10
              border border-red-500/30
              text-red-300
              text-sm
            "
          >
            <span className="material-symbols-outlined text-base">
              error
            </span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="
            w-full
            bg-gradient-to-r from-cyan-400 to-blue-400
            text-black
            font-bold
            py-3
            rounded-lg
            hover:scale-[1.02]
            active:scale-[0.98]
            transition
            shadow-[0_0_20px_rgba(0,240,255,0.25)]
            disabled:opacity-50
            disabled:cursor-not-allowed
            disabled:hover:scale-100
            flex items-center justify-center gap-2
          "
        >
          {loading ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
              <span>Đang xác thực...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">
                login
              </span>
              <span>Vào phòng</span>
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 text-center">
          Mật khẩu được xác thực một lần cho phiên này.
        </p>
      </form>
    </div>
  );
}