"use client";

import { useEffect } from "react";
import { CandidateSideNavBar } from "@/app/components/CandidateSideNavBar";
import { JoinInterviewForm } from "@/app/components/candidate-dashboard/JoinInterviewForm";
import { TopNavBar } from "@/app/components/TopNavBar";

export default function CandidateDashboard() {
  useEffect(() => {
    console.log("NeuralCode AI Candidate Dashboard Initialized");
  }, []);

  return (
    <div className="flex min-h-screen bg-[#051424] text-[#d4e4fa]">
      {/* SIDEBAR */}
      <CandidateSideNavBar />

      {/* MAIN WRAPPER */}
      <div className="flex flex-col flex-1 min-h-screen">
        {/* TOP NAVBAR (fixed inside component) */}
        <TopNavBar />

        {/* MAIN CONTENT AREA */}
        <main className="pt-16 ml-[280px] h-screen overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* JOIN INTERVIEW */}
            <JoinInterviewForm />

            {/* HEADER */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                Lịch sử phỏng vấn
              </h2>

              <div className="flex items-center bg-[#1c2b3c] px-4 py-2 rounded-lg border border-[#3b494b]">
                <span className="material-symbols-outlined text-sm mr-2">
                  filter_list
                </span>
                <span className="text-sm">Tất cả trạng thái</span>
              </div>
            </div>

            {/* CONTENT GRID */}
            <div className="grid grid-cols-12 gap-8">
              {/* LEFT */}
              <div className="col-span-12 lg:col-span-8 space-y-6">
                {/* CARD 1 */}
                <div className="glass-panel p-5 rounded-2xl flex items-center gap-6 hover:bg-[#1c2b3c] transition">
                  <img
                    className="w-14 h-14 bg-white rounded-lg object-contain p-2"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAUPyrzsjkFCAj2TKrVN-gYKyvu_IDW2_3dxl74O-z0fh_oXno-1hyyi85-yrZA094C8EFHmYVHrG2u-rNnY8WeUnEufaz-MuluYjUkTdzZoPCqzV6lKWi_PFoDC8pgKuWCH8JUn6tnBWjDr8xVw1RFRiFv8lHb-OCIEmGPYxpMI8I6-OvRMHvtr1_zNDiuDBiHXAjorSa6zVfdm0tS_hYCfWpe8kLvhhw4fIKxmIx19eyUtFHkVTmiUSvRAxasAyPCHxZdcEW7GV8"
                    alt="Google"
                  />

                  <div className="flex-1">
                    <h4 className="text-lg font-bold">
                      Senior Frontend Engineer
                    </h4>
                    <p className="text-sm text-gray-400">
                      Google Vietnam • 15/10/2023
                    </p>
                  </div>

                  <span className="px-3 py-1 text-sm rounded-full bg-cyan-500/10 text-cyan-300 font-bold">
                    Đã vượt qua
                  </span>
                </div>

                {/* CARD 2 */}
                <div className="glass-panel p-5 rounded-2xl flex items-center gap-6 hover:bg-[#1c2b3c] transition">
                  <img
                    className="w-14 h-14 bg-[#1d1d1f] rounded-lg object-contain p-2 invert"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAPTO-dySnVT7BSdkOBcz-GjPQVEiGPwy9lIW3wLBWVkA0i9eqWnOpZ9eix42a_e-LUqDXZ6MYoYmPC-K63blKMUYWAkFSz3eCl03o9lj0cdwpnBEBhOlYV-Ku57tQ2CweoK1PBP23fVePzmg9097w2CvbkQsf1wExBSM6Rh5P9vhAWxVdeC_djPZubgzocGh5AOWugH3YIx9fQdRkz--2Bdc8yiyfs9232qxMc8Hg3dmV13eypp7fXxxp7WCiyuQL__aP0YJqDTfg"
                    alt="Apple"
                  />

                  <div className="flex-1">
                    <h4 className="text-lg font-bold">Software Architect</h4>
                    <p className="text-sm text-gray-400">Apple • 02/10/2023</p>
                  </div>

                  <span className="px-3 py-1 text-sm rounded-full bg-red-500/10 text-red-300 font-bold">
                    Chưa đạt
                  </span>
                </div>

                {/* CARD 3 */}
                <div className="glass-panel p-5 rounded-2xl flex items-center gap-6 hover:bg-[#1c2b3c] transition">
                  <img
                    className="w-14 h-14 bg-white rounded-lg object-contain p-2"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDlsNXbVW7X8zKJf3K0ySK4VyJ-I5JJlmSRReWkYmiO3Bj7T-p38YdZ13LLUSG9Vfj5vOBOLjiTAoc4V9IHc-CHM6opeu3D9n0TcdeA2ir6MKdqJT--YcTnIlkJFYHkmZpqlGhcBCsLLq_mYCFL7w_EZzhVYCrzZwvUTzDJl6kK-e_MElSeZdP6riDSrj69MWh46kdtdYXgyLiMmPNDLHJcyXp1WafmkQOwoo1E1gi8xt_4f2Ae-srbRMbXsIuCBaVkUVwA26Udgo8"
                    alt="Meta"
                  />

                  <div className="flex-1">
                    <h4 className="text-lg font-bold">Fullstack Developer</h4>
                    <p className="text-sm text-gray-400">Meta • 20/09/2023</p>
                  </div>

                  <span className="px-3 py-1 text-sm rounded-full bg-purple-500/10 text-purple-300 font-bold">
                    Đang chờ
                  </span>
                </div>
              </div>

              {/* RIGHT PANEL */}
              <aside className="col-span-12 lg:col-span-4">
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <h3 className="text-xl font-bold">Câu hỏi phỏng vấn</h3>

                  {/* SEARCH */}
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                      search
                    </span>

                    <input
                      className="w-full bg-[#0d1c2d] border border-[#3b494b] rounded-lg py-2 pl-10 pr-4 text-sm"
                      placeholder="Tìm kiếm chủ đề..."
                    />
                  </div>

                  {/* ITEMS */}
                  <div className="space-y-3">
                    {[
                      "Data Structures",
                      "Algorithms",
                      "System Design",
                      "Frontend Core",
                    ].map((item) => (
                      <div
                        key={item}
                        className="p-3 rounded-lg hover:bg-[#1c2b3c] cursor-pointer flex justify-between"
                      >
                        <span>{item}</span>
                        <span className="material-symbols-outlined text-sm">
                          chevron_right
                        </span>
                      </div>
                    ))}
                  </div>

                  <button className="w-full py-2 rounded-lg bg-cyan-500/10 text-cyan-300 font-bold hover:bg-cyan-500/20 transition">
                    Luyện tập ngay
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
