"use client";

import { useState } from "react";

interface ChangePasswordModalProps {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu mới nhập lại không khớp");
      return;
    }

    if (newPassword === oldPassword) {
      setError("Mật khẩu mới phải khác mật khẩu cũ");
      return;
    }

    const strong =
      newPassword.length >= 8 &&
      /[A-Z]/.test(newPassword) &&
      /[a-z]/.test(newPassword) &&
      /\d/.test(newPassword) &&
      /[^A-Za-z0-9]/.test(newPassword);

    if (!strong) {
      setError(
        "Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt",
      );
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Có lỗi xảy ra, vui lòng thử lại");
        setLoading(false);
        return;
      }

      // Backend có thể trả token mới để invalidate token cũ (rotation).
      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      setSuccess(true);
      setLoading(false);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch {
      setError("Không thể kết nối tới máy chủ");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0B1120] border border-white/10 rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-on-surface">
            Đổi mật khẩu
          </h2>
          <button
            onClick={onClose}
            className="material-symbols-outlined text-on-surface-variant hover:text-primary-fixed"
          >
            close
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <span className="material-symbols-outlined text-4xl text-green-400">
              check_circle
            </span>
            <p className="text-sm text-on-surface-variant">
              Đổi mật khẩu thành công
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-on-surface-variant">
                Mật khẩu hiện tại
              </label>
              <div className="relative">
                <input
                  type={showOldPassword ? "text" : "password"}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 pr-10 text-sm text-on-surface outline-none focus:border-cyan-500"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant hover:text-primary-fixed"
                >
                  {showOldPassword ? "visibility_off" : "visibility"}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-on-surface-variant">
                Mật khẩu mới
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 pr-10 text-sm text-on-surface outline-none focus:border-cyan-500"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant hover:text-primary-fixed"
                >
                  {showNewPassword ? "visibility_off" : "visibility"}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-on-surface-variant">
                Nhập lại mật khẩu mới
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 pr-10 text-sm text-on-surface outline-none focus:border-cyan-500"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant hover:text-primary-fixed"
                >
                  {showConfirmPassword ? "visibility_off" : "visibility"}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm rounded-lg bg-cyan-500 text-black font-medium hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Đang lưu..." : "Lưu mật khẩu"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
