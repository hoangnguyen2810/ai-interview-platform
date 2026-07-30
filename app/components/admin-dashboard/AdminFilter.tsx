"use client";

import { Search } from "lucide-react";
import type { ReactNode } from "react";

type AdminFilterProps = {
  search: string;
  onSearchChange: (value: string) => void;
  selects?: {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
  }[];
  rightSlot?: ReactNode;
};

export function AdminFilter({
  search,
  onSearchChange,
  selects = [],
  rightSlot,
}: AdminFilterProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm kiếm…"
          className="w-full bg-[#071524] border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 outline-none text-slate-200"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {selects.map((s, idx) => (
          <select
            key={idx}
            value={s.value}
            onChange={(e) => s.onChange(e.target.value)}
            className="bg-[#071524] border border-slate-700 rounded-xl px-4 py-3 min-w-[160px] focus:border-cyan-500 outline-none text-sm text-slate-200"
          >
            {s.placeholder && <option value="">{s.placeholder}</option>}
            {s.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}

        {rightSlot}
      </div>
    </div>
  );
}
