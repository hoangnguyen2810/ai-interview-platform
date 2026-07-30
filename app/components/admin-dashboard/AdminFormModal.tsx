"use client";

import { useEffect, useState, type ReactNode } from "react";

export type AdminFormField = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: string;
};

type AdminFormModalProps = {
  open: boolean;
  title: string;
  fields: AdminFormField[];
  initialValues?: Record<string, string>;
  submitText?: string;
  cancelText?: string;
  loading?: boolean;
  error?: string | null;
  onSubmit: (values: Record<string, string>) => void;
  onClose: () => void;
  extra?: ReactNode;
};

export function AdminFormModal({
  open,
  title,
  fields,
  initialValues,
  submitText = "Lưu",
  cancelText = "Hủy",
  loading,
  error,
  onSubmit,
  onClose,
  extra,
}: AdminFormModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const seed: Record<string, string> = {};
    fields.forEach((f) => {
      seed[f.name] =
        (initialValues && initialValues[f.name]) || f.defaultValue || "";
    });
    setValues(seed);
  }, [open, fields, initialValues]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of fields) {
      if (f.required && !values[f.name]?.trim()) return;
    }
    onSubmit(values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0B1120] border border-white/10 rounded-2xl p-8 shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
          <button
            onClick={onClose}
            className="material-symbols-outlined text-on-surface-variant hover:text-primary-fixed"
            type="button"
          >
            close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {fields.map((f) => {
            const id = `admin-form-${f.name}`;
            return (
              <div key={f.name} className="flex flex-col gap-1">
                <label
                  htmlFor={id}
                  className="text-sm text-on-surface-variant"
                >
                  {f.label}
                  {f.required && <span className="text-rose-400"> *</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    id={id}
                    value={values[f.name] || ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.name]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                    rows={4}
                    className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-cyan-500"
                  />
                ) : f.type === "select" ? (
                  <select
                    id={id}
                    value={values[f.name] || ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.name]: e.target.value }))
                    }
                    className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-cyan-500"
                  >
                    {f.placeholder && (
                      <option value="">{f.placeholder}</option>
                    )}
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type={f.type || "text"}
                    value={values[f.name] || ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.name]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                    className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-cyan-500"
                  />
                )}
              </div>
            );
          })}

          {extra}

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface"
            >
              {cancelText}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm rounded-lg bg-cyan-500 text-black font-medium hover:bg-cyan-400 disabled:opacity-50"
            >
              {loading ? "Đang lưu…" : submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
