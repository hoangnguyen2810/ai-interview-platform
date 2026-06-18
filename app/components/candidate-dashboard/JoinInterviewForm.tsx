"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CODE_PATTERN = /^NC-[A-Z0-9]{8}$/i;

export function JoinInterviewForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = code.trim().toUpperCase();
    if (!CODE_PATTERN.test(normalized)) {
      setError("Mã phòng không hợp lệ (định dạng: NC-XXXXXXXX)");
      return;
    }

    router.push(`/join/${encodeURIComponent(normalized)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[#3b494b] bg-[#0d1c2d] p-6 flex flex-col gap-4"
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-cyan-300">
          video_call
        </span>
        <h2 className="text-lg font-bold text-cyan-200">Tham gia phỏng vấn</h2>
      </div>

      <p className="text-sm text-gray-400">
        Nhập mã phòng mà recruiter đã gửi cho bạn.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="VD: NC-8F3K2Q9X"
          maxLength={11}
          className="flex-1 px-3 py-2 rounded-lg bg-[#122131] border border-[#3b494b] text-cyan-200 font-mono tracking-widest placeholder:text-gray-500 focus:outline-none focus:border-cyan-400"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-400 text-black font-bold hover:scale-[1.02] active:scale-[0.98] transition"
        >
          Vào
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
