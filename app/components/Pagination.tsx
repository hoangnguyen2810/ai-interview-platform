"use client";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    const window = 1;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    const start = Math.max(2, currentPage - window);
    const end = Math.min(totalPages - 1, currentPage + window);

    if (start > 2) pages.push("...");

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) pages.push("...");

    pages.push(totalPages);

    return pages;
  };

  const pages = getPageNumbers();

  const buttonClass =
    "min-w-[36px] h-9 px-3 inline-flex items-center justify-center rounded-lg text-sm font-medium transition";

  return (
    <nav className="flex items-center gap-1">
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className={`${buttonClass} border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        ‹
      </button>

      {pages.map((page, index) =>
        page === "..." ? (
          <span
            key={index}
            className="min-w-[36px] h-9 flex items-center justify-center text-slate-500"
          >
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={
              page === currentPage
                ? `${buttonClass} bg-cyan-500 text-black`
                : `${buttonClass} border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-400`
            }
          >
            {page}
          </button>
        ),
      )}

      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className={`${buttonClass} border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        ›
      </button>
    </nav>
  );
}
