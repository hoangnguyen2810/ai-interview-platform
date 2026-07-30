"use client";

import { Pagination } from "@/app/components/Pagination";

type AdminPaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function AdminPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: AdminPaginationProps) {
  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-xs text-slate-400">
        Hiển thị {(currentPage - 1) * pageSize + 1}–
        {Math.min(currentPage * pageSize, totalItems)} / {totalItems} kết quả
      </p>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
