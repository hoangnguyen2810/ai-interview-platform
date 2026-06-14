"use client";

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function EditProfileModal({
  open,
  onClose,
}: EditProfileModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-surface-container p-6 border border-outline-variant">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Chỉnh sửa hồ sơ</h2>

          <button onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <input
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="Họ tên"
          />

          <input
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="Số điện thoại"
          />

          <input
            className="p-3 rounded-xl bg-surface-container-high md:col-span-2"
            placeholder="GitHub URL"
          />

          <input
            className="p-3 rounded-xl bg-surface-container-high md:col-span-2"
            placeholder="LinkedIn URL"
          />

          <input
            type="number"
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="Số năm kinh nghiệm"
          />

          <input
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="CV URL"
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-outline-variant"
          >
            Hủy
          </button>

          <button className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container font-bold">
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}
