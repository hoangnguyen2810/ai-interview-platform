"use client";

import type { ReactNode } from "react";

type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
  headerClassName?: string;
  cellClassName?: string;
};

type AdminTableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
};

export function AdminTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  emptyMessage = "Chưa có dữ liệu",
  onRowClick,
}: AdminTableProps<T>) {
  if (loading) {
    return (
      <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-10 text-center text-slate-400">
        <span className="inline-block animate-spin mr-2">⟳</span>
        Đang tải…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-10 text-center text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left">
          <thead className="bg-[#13263a] text-xs uppercase tracking-widest text-slate-300">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-5 py-4 font-semibold align-middle ${
                    c.width ?? ""
                  } ${c.headerClassName ?? ""}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-t border-slate-800 transition hover:bg-cyan-500/5 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-5 py-4 align-middle ${
                      c.width ?? ""
                    } ${c.cellClassName ?? ""}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
