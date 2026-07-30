"use client";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  destructive,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0B1120] border border-white/10 rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
        {description && (
          <p className="mt-2 text-sm text-on-surface-variant">
            {description}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-50 ${
              destructive
                ? "bg-rose-500 text-white hover:bg-rose-400"
                : "bg-cyan-500 text-black hover:bg-cyan-400"
            }`}
          >
            {loading ? "Đang xử lý…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
