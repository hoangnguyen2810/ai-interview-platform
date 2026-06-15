"use client";

import { useState } from "react";
import { CreateInterviewModal } from "./CreateInterviewModal";

export function HeroSection() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="relative mb-10 p-8 rounded-3xl overflow-hidden glass-card">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="font-headline-xl text-headline-xl mb-2">
              Chào buổi sáng, Quân!
            </h1>

            <p className="text-on-surface-variant max-w-lg">
              Hệ thống AI đã chuẩn bị sẵn 4 hồ sơ ứng viên cho buổi phỏng vấn
              ngày hôm nay. Chúc bạn một ngày làm việc hiệu quả!
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-primary-container text-on-primary-fixed font-bold px-8 py-4 rounded-xl hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all flex items-center gap-2 group"
          >
            <span className="material-symbols-outlined group-hover:rotate-90 transition-transform">
              add
            </span>
            Tạo buổi phỏng vấn mới
          </button>
        </div>
      </section>

      <CreateInterviewModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(interview) => {
          console.log("Created interview:", interview);
        }}
      />
    </>
  );
}
