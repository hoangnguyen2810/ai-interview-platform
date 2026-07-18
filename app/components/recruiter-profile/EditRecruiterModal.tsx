"use client";

import { useEffect, useState } from "react";

import { updateRecruiterProfile } from "@/lib/profile-api";
import type { RecruiterProfile } from "@/lib/profile-types";

interface Props {
  open: boolean;
  onClose: () => void;
  profile: RecruiterProfile;
  onSaved?: (next: RecruiterProfile) => void;
}

interface FormState {
  fullName: string;
  position: string;
  phone: string;
  bio: string;
  linkedinUrl: string;
  avatarUrl: string;
  coverImageUrl: string;
  companyName: string;
  companyWebsite: string;
  companyDescription: string;
  companyLogoUrl: string;
}

function toForm(p: RecruiterProfile): FormState {
  return {
    fullName: p.fullName,
    position: p.position,
    phone: p.phone,
    bio: p.bio,
    linkedinUrl: p.linkedinUrl,
    avatarUrl: p.avatarUrl,
    coverImageUrl: p.coverImageUrl,
    companyName: p.company.name,
    companyWebsite: p.company.website,
    companyDescription: p.company.description,
    companyLogoUrl: p.company.logoUrl,
  };
}

export default function EditRecruiterModal({
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
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        fullName: form.fullName,
        position: form.position,
        phone: form.phone,
        bio: form.bio,
        linkedinUrl: form.linkedinUrl,
        avatarUrl: form.avatarUrl,
        coverImageUrl: form.coverImageUrl,
        companyName: form.companyName,
        companyWebsite: form.companyWebsite,
        companyDescription: form.companyDescription,
        companyLogoUrl: form.companyLogoUrl,
      };

      await updateRecruiterProfile(payload);
      onSaved?.({
        ...profile,
        fullName: form.fullName,
        position: form.position,
        phone: form.phone,
        bio: form.bio,
        linkedinUrl: form.linkedinUrl,
        avatarUrl: form.avatarUrl,
        coverImageUrl: form.coverImageUrl,
        company: {
          name: form.companyName,
          website: form.companyWebsite,
          description: form.companyDescription,
          logoUrl: form.companyLogoUrl,
        },
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
          <h2 className="text-xl font-bold">Chỉnh sửa hồ sơ Nhà tuyển dụng</h2>
          <button onClick={onClose} disabled={saving}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <h3 className="md:col-span-2 font-semibold text-sm opacity-70">
            Công ty
          </h3>
          <input
            name="companyName"
            value={form.companyName}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="Tên công ty"
          />
          <input
            name="companyWebsite"
            value={form.companyWebsite}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="Website"
          />
          <input
            name="companyLogoUrl"
            value={form.companyLogoUrl}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high md:col-span-2"
            placeholder="Logo URL"
          />
          <textarea
            name="companyDescription"
            value={form.companyDescription}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high md:col-span-2"
            placeholder="Mô tả công ty"
            rows={3}
          />

          <h3 className="md:col-span-2 font-semibold text-sm opacity-70 mt-2">
            Cá nhân
          </h3>
          <input
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="Họ tên"
          />
          <input
            name="position"
            value={form.position}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="Vị trí"
          />
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="Số điện thoại"
          />
          <input
            name="linkedinUrl"
            value={form.linkedinUrl}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="LinkedIn URL"
          />
          <input
            name="avatarUrl"
            value={form.avatarUrl}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="Avatar URL"
          />
          <input
            name="coverImageUrl"
            value={form.coverImageUrl}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high"
            placeholder="Cover image URL"
          />
          <textarea
            name="bio"
            value={form.bio}
            onChange={handleChange}
            className="p-3 rounded-xl bg-surface-container-high md:col-span-2"
            placeholder="Giới thiệu"
            rows={3}
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
