"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CandidateEditModal({ open, onClose }: Props) {
  const [form, setForm] = useState({
    phone: "+84 912 345 678",
    github_url: "",
    linkedin_url: "",
    experience_years: 3,
  });

  if (!open) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    await fetch("/api/candidate/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[500px] glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Edit Profile</h2>

          <button onClick={onClose} className="text-on-surface-variant">
            ✕
          </button>
        </div>

        <input
          name="phone"
          value={form.phone}
          onChange={handleChange}
          className="w-full p-3 rounded bg-surface-container-high"
          placeholder="Phone"
        />

        <input
          name="github_url"
          value={form.github_url}
          onChange={handleChange}
          className="w-full p-3 rounded bg-surface-container-high"
          placeholder="GitHub URL"
        />

        <input
          name="linkedin_url"
          value={form.linkedin_url}
          onChange={handleChange}
          className="w-full p-3 rounded bg-surface-container-high"
          placeholder="LinkedIn URL"
        />

        <input
          name="experience_years"
          type="number"
          value={form.experience_years}
          onChange={handleChange}
          className="w-full p-3 rounded bg-surface-container-high"
          placeholder="Experience Years"
        />

        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-primary text-black font-bold"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
