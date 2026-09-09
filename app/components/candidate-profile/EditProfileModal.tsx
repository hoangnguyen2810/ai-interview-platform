"use client";

import { useEffect, useState } from "react";

import type { CandidateProfile } from "@/lib/profile-types";
import { updateCandidateProfile } from "@/lib/profile-api";

type Props = {
  open: boolean;
  onClose: () => void;
  profile: CandidateProfile;
  onSaved?: (next: CandidateProfile) => void;
};

interface FormState {
  fullName: string;
  phone: string;
  avatarUrl: string;
  cvUrl: string;
  githubUrl: string;
  linkedinUrl: string;
  experienceYears: number | "";
}

function toForm(p: CandidateProfile): FormState {
  return {
    fullName: p.fullName,
    phone: p.phone,
    avatarUrl: p.avatarUrl,
    cvUrl: p.cvUrl,
    githubUrl: p.githubUrl,
    linkedinUrl: p.linkedinUrl,
    experienceYears: p.experienceYears ?? "",
  };
}

export default function EditProfileModal({
  open,
  onClose,
  profile,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(toForm(profile));
      setError("");
    }
  }, [open, profile]);

  if (!open) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? (value === "" ? "" : Number(value)) : value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        fullName: form.fullName,
        phone: form.phone,
        avatarUrl: form.avatarUrl,
        cvUrl: form.cvUrl,
        githubUrl: form.githubUrl,
        linkedinUrl: form.linkedinUrl,
        experienceYears:
          form.experienceYears === "" ? null : Number(form.experienceYears),
      };

      await updateCandidateProfile(payload);
      onSaved?.({
        ...profile,
        fullName: form.fullName,
        phone: form.phone,
        avatarUrl: form.avatarUrl,
        cvUrl: form.cvUrl,
        githubUrl: form.githubUrl,
        linkedinUrl: form.linkedinUrl,
        experienceYears:
          form.experienceYears === "" ? 0 : Number(form.experienceYears),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu thay đổi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl bg-surface-container p-6 border border-outline-variant">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Chỉnh sửa hồ sơ</h2>
          <button onClick={onClose} disabled={saving}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <input
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="Họ tên"
          />
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="Số điện thoại"
          />
          <input
            name="avatarUrl"
            value={form.avatarUrl}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high md:col-span-2"
            placeholder="Avatar URL"
          />
          <input
            name="githubUrl"
            value={form.githubUrl}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="GitHub URL"
          />
          <input
            name="linkedinUrl"
            value={form.linkedinUrl}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="LinkedIn URL"
          />
          <input
            type="number"
            name="experienceYears"
            value={form.experienceYears}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="Số năm kinh nghiệm"
            min={0}
            max={70}
          />
          <input
            name="cvUrl"
            value={form.cvUrl}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="CV URL"
          />
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-outline-variant"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container font-bold disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}
