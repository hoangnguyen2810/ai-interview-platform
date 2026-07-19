"use client";

import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (interview: CreatedInterview) => void;
  /**
   * `create` (mặc định): form tạo + success screen sau khi tạo xong.
   * `detail`: chỉ hiện success screen với interview có sẵn (readonly).
   *            Dùng cho nút "Chi tiết" ở UpcomingInterviews khi SCHEDULED.
   */
  mode?: "create" | "detail";
  /** Chỉ dùng ở mode='detail': interview cần hiển thị chi tiết. */
  detailInterview?: CreatedInterview | null;
}

export interface CreatedInterview {
  id: string;
  title: string;
  description: string | null;
  meetingCode: string;
  roomPassword: string | null;
  allowGuest: boolean;
  maxParticipants: number;
  maxInterviewers: 2 | 3;
  durationMinutes: 30 | 60 | 90 | 120;
  status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";
  enableRecording: boolean;
  scheduledAt: string;
  createdAt: string;
  avatarUrl: string | null;
}

interface FormState {
  title: string;
  description: string;
  scheduledAt: string; // value của <input type="datetime-local">
  roomPassword: string;
  durationMinutes: 30 | 60 | 90 | 120;
  maxInterviewers: 2 | 3;
  allowGuest: boolean;
  enableRecording: boolean;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  scheduledAt: "",
  roomPassword: "",
  durationMinutes: 60,
  maxInterviewers: 2,
  allowGuest: true,
  enableRecording: false,
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

async function fetchRecruiterAvatar(): Promise<string | null> {
  try {
    const token = getToken();
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch("/api/recruiter/profile", { headers });
    if (!res.ok) return null;
    const json = await res.json();
    return json.profile?.avatarUrl ?? null;
  } catch {
    return null;
  }
}

function localToIso(local: string): string | null {
  // input[type=datetime-local] cho value dạng "YYYY-MM-DDTHH:mm"
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function CreateInterviewModal({
  open,
  onClose,
  onCreated,
  mode = "create",
  detailInterview = null,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInterview | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setFieldError(null);
      setCopied(false);
      // mode=detail: hiển thị thẳng success screen, không cần reset form.
      if (mode === "detail" && detailInterview) {
        setCreated(detailInterview);
      } else {
        setForm(EMPTY_FORM);
        setCreated(null);
      }
    }
  }, [open, mode, detailInterview]);

  if (!open) return null;

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : name === "durationMinutes"
            ? (Number(value) as FormState["durationMinutes"])
            : name === "maxInterviewers"
              ? (Number(value) as FormState["maxInterviewers"])
              : value,
    }));
  };

  const clientValidate = (): string | null => {
    if (!form.title.trim()) return "Vui lòng nhập tên buổi phỏng vấn";
    if (form.title.trim().length > 255)
      return "Tên buổi phỏng vấn tối đa 255 ký tự";
    if (!form.scheduledAt) return "Vui lòng chọn ngày giờ phỏng vấn";
    const iso = localToIso(form.scheduledAt);
    if (!iso) return "Ngày giờ không hợp lệ";
    if (new Date(iso).getTime() <= Date.now())
      return "Ngày giờ phỏng vấn phải ở trong tương lai";
    if (form.roomPassword && form.roomPassword.length > 100)
      return "Mật khẩu phòng tối đa 100 ký tự";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const localErr = clientValidate();
    if (localErr) {
      setError(localErr);
      return;
    }

    const scheduledAtIso = localToIso(form.scheduledAt);
    if (!scheduledAtIso) {
      setError("Ngày giờ không hợp lệ");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description:
        form.description.trim() === "" ? null : form.description.trim(),
      roomPassword:
        form.roomPassword.trim() === "" ? null : form.roomPassword.trim(),
      allowGuest: form.allowGuest,
      maxParticipants: 10,
      maxInterviewers: form.maxInterviewers,
      durationMinutes: form.durationMinutes,
      enableRecording: form.enableRecording,
      scheduledAt: scheduledAtIso,
    };

    setSubmitting(true);
    try {
      const token = getToken();
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch("/api/interviews", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          (json && typeof json.message === "string" && json.message) ||
          `Tạo phòng thất bại (${res.status})`;
        setError(message);
        if (json && typeof json.field === "string") setFieldError(json.field);
        return;
      }

      const interview = json.interview as CreatedInterview;
      const avatarUrl = await fetchRecruiterAvatar();
      setCreated({ ...interview, avatarUrl });
      onCreated?.({ ...interview, avatarUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo phòng");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.meetingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard không khả dụng – bỏ qua */
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  // ---------- Chế độ chi tiết: chỉ hiển thị màn hình thành công ----------
  if (mode === "detail" && created) {
    const canEnter =
      created.status !== "FINISHED" &&
      new Date(created.scheduledAt).getTime() <= Date.now();

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm ">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0B1120] p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-cyan-400 text-3xl">
              event_note
            </span>
            <h2 className="text-xl font-bold">Chi tiết buổi phỏng vấn</h2>
          </div>

          <p className="text-sm text-gray-300 mb-5">
            Thông tin phòng phỏng vấn. Chia sẻ mã bên dưới cho ứng viên.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">
              Meeting code
            </p>
            <div className="flex items-center justify-between gap-3">
              <code className="text-2xl font-mono font-bold text-cyan-300">
                {created.meetingCode}
              </code>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-sm hover:bg-white/5"
              >
                {copied ? "Đã copy" : "Copy"}
              </button>
            </div>
          </div>

          <dl className="text-sm space-y-1 text-gray-300 mb-6">
            <div className="flex justify-between">
              <dt>Tiêu đề</dt>
              <dd className="font-medium text-white">{created.title}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Thời lượng</dt>
              <dd className="font-medium text-white">
                {created.durationMinutes} phút
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Interviewer tối đa</dt>
              <dd className="font-medium text-white">
                {created.maxInterviewers}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Thời gian</dt>
              <dd className="font-medium text-white">
                {new Date(created.scheduledAt).toLocaleString("vi-VN")}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Ghi hình</dt>
              <dd className="font-medium text-white">
                {created.enableRecording ? "Có" : "Không"}
              </dd>
            </div>
          </dl>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 rounded-xl border border-white/10"
            >
              Đóng
            </button>
            {canEnter && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/interview/room/${encodeURIComponent(created.meetingCode)}`;
                }}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 font-semibold hover:bg-cyan-400"
              >
                Vào phòng
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Màn hình thành công (sau khi tạo) ----------
  if (created) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0B1120] p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-emerald-400 text-3xl">
              check_circle
            </span>
            <h2 className="text-xl font-bold">Tạo phòng thành công</h2>
          </div>

          <p className="text-sm text-gray-300 mb-5">
            Phòng phỏng vấn đã sẵn sàng. Chia sẻ mã bên dưới cho ứng viên.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">
              Meeting code
            </p>
            <div className="flex items-center justify-between gap-3">
              <code className="text-2xl font-mono font-bold text-cyan-300">
                {created.meetingCode}
              </code>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-sm hover:bg-white/5"
              >
                {copied ? "Đã copy" : "Copy"}
              </button>
            </div>
          </div>

          <dl className="text-sm space-y-1 text-gray-300 mb-6">
            <div className="flex justify-between">
              <dt>Tiêu đề</dt>
              <dd className="font-medium text-white">{created.title}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Thời lượng</dt>
              <dd className="font-medium text-white">
                {created.durationMinutes} phút
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Người phỏng vấn tối đa</dt>
              <dd className="font-medium text-white">
                {created.maxInterviewers}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Thời gian</dt>
              <dd className="font-medium text-white">
                {new Date(created.scheduledAt).toLocaleString("vi-VN")}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Ghi hình</dt>
              <dd className="font-medium text-white">
                {created.enableRecording ? "Có" : "Không"}
              </dd>
            </div>
          </dl>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 font-semibold hover:bg-cyan-400"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Form ----------
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0B1120] p-8 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Tạo buổi phỏng vấn</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="material-symbols-outlined disabled:opacity-40"
          >
            close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block mb-2 font-medium">
              Tên buổi phỏng vấn <span className="text-red-400">*</span>
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              maxLength={255}
              className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3"
              placeholder="Frontend React Interview"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium">Mô tả</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3"
              placeholder="Mô tả buổi phỏng vấn..."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 font-medium">
                Ngày giờ phỏng vấn <span className="text-red-400">*</span>
              </label>
              <input
                name="scheduledAt"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3"
              />
            </div>

            <div>
              <label className="block mb-2 font-medium">Mật khẩu phòng</label>
              <input
                name="roomPassword"
                type="text"
                value={form.roomPassword}
                onChange={handleChange}
                maxLength={100}
                className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3"
                placeholder="123456"
              />
            </div>
          </div>

          <div>
            <label className="block mb-2 font-medium">
              Thời lượng phỏng vấn
            </label>
            <select
              name="durationMinutes"
              value={form.durationMinutes}
              onChange={handleChange}
              className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3"
            >
              <option value={30}>30 phút</option>
              <option value={60}>60 phút</option>
              <option value={90}>90 phút</option>
              <option value={120}>120 phút</option>
            </select>
          </div>

          <div>
            <label className="block mb-3 font-medium">
              Số lượng HR tham gia
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="maxInterviewers"
                  value={2}
                  checked={form.maxInterviewers === 2}
                  onChange={handleChange}
                />
                <span>2 người</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="maxInterviewers"
                  value={3}
                  checked={form.maxInterviewers === 3}
                  onChange={handleChange}
                />
                <span>3 người</span>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 p-4">
            <p className="text-sm text-gray-300">
              Mỗi buổi phỏng vấn chỉ cho phép 1 ứng viên tham gia.
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-white/10 p-4">
            <input
              id="enableRecording"
              name="enableRecording"
              type="checkbox"
              checked={form.enableRecording}
              onChange={handleChange}
              className="mt-1"
            />
            <label htmlFor="enableRecording" className="flex-1 cursor-pointer">
              <span className="block font-medium">Ghi hình buổi phỏng vấn</span>
              <span className="block text-xs text-gray-400 mt-1">
                Khi bật, buổi phỏng vấn sẽ được tự động ghi hình ngay khi cuộc
                gọi bắt đầu và dừng khi kết thúc. File ghi hình sẽ hiển thị
                trong mục lưu trữ.
              </span>
            </label>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
              {fieldError && (
                <span className="block text-xs opacity-80 mt-1">
                  Trường: <code>{fieldError}</code>
                </span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-6 py-3 rounded-xl border border-white/10 disabled:opacity-40"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-xl bg-cyan-500 font-semibold hover:bg-cyan-400 disabled:opacity-50"
            >
              {submitting ? "Đang tạo..." : "Tạo phòng"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
