export function AIAssistantPanel() {
  return (
    <div className="space-y-6">
      <h2 className="font-headline-lg text-headline-lg">
        Hỗ trợ tạo chuỗi phỏng vấn
      </h2>
      <div className="glass-card rounded-2xl p-6 space-y-6 neon-border-hover transition-all">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg ai-gradient flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary">
                auto_awesome
              </span>
            </div>
            <div>
              <h3 className="font-bold text-on-surface leading-tight">
                Thiết lập chuỗi
              </h3>
              <p className="text-[10px] text-primary-fixed-dim uppercase tracking-widest">
                CodePilot AI Engine
              </p>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Tự động thiết lập và lên lịch cho nhiều ứng viên trong ngày dựa trên
            JD và danh sách hồ sơ.
          </p>
          <button
            type="button"
            className="w-full bg-surface-container-highest border border-dashed border-outline-variant hover:border-primary-fixed text-on-surface-variant hover:text-primary-fixed transition-all rounded-xl py-4 flex flex-col items-center justify-center gap-2 group"
          >
            <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">
              cloud_upload
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Tải lên danh sách ứng viên (Excel/CSV/PDF)
            </span>
          </button>
          <div className="space-y-2">
            <label
              htmlFor="jd-description"
              className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider"
            >
              Mô tả vị trí / JD
            </label>
            <textarea
              id="jd-description"
              className="w-full bg-surface-container border border-outline-variant rounded-xl p-4 text-sm text-on-surface focus:ring-1 focus:ring-primary-fixed outline-none min-h-[120px] resize-none"
              placeholder="Dán JD hoặc các kỹ năng cần đánh giá hàng loạt tại đây..."
            />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              className="w-full bg-primary-container text-on-primary-fixed font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">
                auto_awesome
              </span>
              Phân bổ lịch trình tự động
            </button>
            <button
              type="button"
              className="w-full bg-secondary-container/30 border border-secondary-container text-on-secondary-container font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-secondary-container/50 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">
                group_add
              </span>
              Tạo hàng loạt phòng chờ
            </button>
          </div>
        </div>
        <div className="p-4 bg-primary-container/10 border border-primary-fixed/20 rounded-xl flex gap-3">
          <span className="material-symbols-outlined text-primary-fixed">
            info
          </span>
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            Hệ thống sẽ tự động đối chiếu hồ sơ với JD để gợi ý thứ tự phỏng vấn
            tối ưu nhất.
          </p>
        </div>
      </div>
    </div>
  );
}
