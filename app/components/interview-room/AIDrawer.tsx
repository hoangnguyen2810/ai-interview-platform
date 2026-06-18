"use client";

import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AIDrawer({ open, onClose }: Props) {
  return (
    <>
      {/* overlay */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-[360px] bg-[#0d1c2d]/95 backdrop-blur-md border-l border-white/10 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-white font-semibold">AI Assistant</h2>

          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        {/* content */}
        <div className="p-4 text-white">AI chat / assistant UI ở đây</div>
      </div>
    </>
  );
}
