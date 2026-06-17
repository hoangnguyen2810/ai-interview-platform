"use client";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function QuestionsDrawer({ open, onClose }: Props) {
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`
          fixed inset-0 bg-black/50 z-40 transition-opacity
          ${open ? "opacity-100" : "opacity-0 pointer-events-none"}
        `}
      />

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 right-0 h-screen w-[420px]
          bg-[#051424]
          border-l border-[#3b494b]
          z-50
          transition-transform duration-300
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="h-16 px-6 flex items-center justify-between border-b border-[#3b494b]">
          <h2 className="text-white font-semibold">Questions</h2>

          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto h-[calc(100vh-64px)]">
          {/* Nội dung câu hỏi */}
          <p className="text-gray-300">
            Interview questions sẽ hiển thị ở đây.
          </p>
        </div>
      </aside>
    </>
  );
}
