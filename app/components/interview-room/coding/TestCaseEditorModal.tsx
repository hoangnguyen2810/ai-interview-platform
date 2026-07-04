"use client";

import { useState, useEffect } from "react";

interface AITestCase {
  id: string;
  description: string;
  edgeCaseType: string;
  inputData: string;
  expectedOutput: string;
  actualOutput: string;
  status: "PENDING" | "PASSED" | "FAILED" | "RUNTIME_ERROR" | "TIMEOUT";
  runtimeMs: number;
  source?: "AI" | "MANUAL";
  aiVerified?: boolean | null;
}

interface Props {
  meetingCode: string;
  submissionId: string;
  test: AITestCase;
  onClose: () => void;
  onSave: (
    id: string,
    patch: {
      inputData: string;
      expectedOutput: string;
      description: string;
      edgeCaseType: string;
    },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EDGE_CASE_TYPES = [
  "empty",
  "single",
  "large",
  "negative",
  "duplicate",
  "overflow",
  "boundary",
  "random",
];

export default function TestCaseEditorModal({
  meetingCode,
  test,
  onClose,
  onSave,
  onDelete,
}: Props) {
  void meetingCode; // currently unused; kept for future API changes.
  const [inputData, setInputData] = useState(test.inputData ?? "");
  const [expectedOutput, setExpectedOutput] = useState(test.expectedOutput);
  const [description, setDescription] = useState(test.description);
  const [edgeCaseType, setEdgeCaseType] = useState(test.edgeCaseType);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when the target test changes.
  // Keep inputData initialised from the DB row (so re-opening the modal shows
  // what was previously saved). Editing is expected; clearing on switch would
  // discard work.
  useEffect(() => {
    setInputData(test.inputData ?? "");
    setExpectedOutput(test.expectedOutput);
    setDescription(test.description);
    setEdgeCaseType(test.edgeCaseType);
    setError(null);
  }, [test]);

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      await onSave(test.id, {
        inputData,
        expectedOutput,
        description,
        edgeCaseType,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Xoá test case này?")) return;
    setError(null);
    setDeleting(true);
    try {
      await onDelete(test.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
          <div>
            <p className="text-[13px] text-[#e4e4e4] font-medium">
              Chỉnh sửa test case
            </p>
            <p className="text-[10.5px] text-[#9a9a9a] mt-0.5">
              {test.id.slice(0, 8)} · nguồn: {test.source === "MANUAL" ? "Recruiter" : "AI"} · trạng thái: {test.status}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#9a9a9a] hover:text-[#e4e4e4] text-lg leading-none"
            title="Đóng"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[11px] text-[#9a9a9a] mb-1">
              Input (stdin) — dữ liệu chương trình <strong>đọc</strong>
            </label>
            <textarea
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              rows={4}
              placeholder={`Ví dụ (Two Sum):\n4\n2, 7, 11, 15\n9`}
              className="w-full bg-[#0e0e0e] border border-[#2a2a2a] rounded p-2 text-[12px] text-[#e4e4e4] font-mono focus:outline-none focus:border-[#3b82f6] placeholder:text-[#5a5a5a] placeholder:italic"
              spellCheck={false}
            />
          </div>

          <div>
            <label className="block text-[11px] text-[#9a9a9a] mb-1">
              Expected output (stdout) — cái chương trình <strong>in ra</strong>
            </label>
            <textarea
              value={expectedOutput}
              onChange={(e) => setExpectedOutput(e.target.value)}
              rows={3}
              placeholder={`Ví dụ (Two Sum):\n0, 2`}
              className="w-full bg-[#0e0e0e] border border-[#2a2a2a] rounded p-2 text-[12px] text-[#e4e4e4] font-mono focus:outline-none focus:border-[#3b82f6] placeholder:text-[#5a5a5a] placeholder:italic"
              spellCheck={false}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#9a9a9a] mb-1">
                Loại edge case
              </label>
              <select
                value={edgeCaseType}
                onChange={(e) => setEdgeCaseType(e.target.value)}
                className="w-full bg-[#0e0e0e] border border-[#2a2a2a] rounded p-2 text-[12px] text-[#e4e4e4] focus:outline-none focus:border-[#3b82f6]"
              >
                {EDGE_CASE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#9a9a9a] mb-1">
                Runtime (ms) — sau khi chạy
              </label>
              <div className="bg-[#0e0e0e] border border-[#2a2a2a] rounded p-2 text-[12px] text-[#9a9a9a] font-mono">
                {test.runtimeMs} ms
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[#9a9a9a] mb-1">
              Mô tả / lý do kiểm tra
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-[#0e0e0e] border border-[#2a2a2a] rounded p-2 text-[12px] text-[#e4e4e4] focus:outline-none focus:border-[#3b82f6]"
            />
          </div>

          {test.actualOutput && (
            <div>
              <label className="block text-[11px] text-[#9a9a9a] mb-1">
                Actual output (lần chạy gần nhất)
              </label>
              <pre className="bg-[#0e0e0e] border border-[#2a2a2a] rounded p-2 text-[11.5px] text-[#dcdcdc] font-mono whitespace-pre-wrap">
                {test.actualOutput || "(trống)"}
              </pre>
            </div>
          )}

          {error && (
            <div className="px-2.5 py-1.5 rounded bg-red-900/40 border border-red-800 text-[11px] text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[#2a2a2a] flex items-center justify-between gap-2">
          <button
            onClick={remove}
            disabled={deleting || saving}
            className="text-[11px] px-3 py-1.5 rounded border border-red-700 text-red-300 hover:bg-red-900/40 disabled:opacity-50"
          >
            {deleting ? "Đang xoá…" : "Xoá"}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving || deleting}
              className="text-[11px] px-3 py-1.5 rounded border border-[#2a2a2a] text-[#9a9a9a] hover:text-[#e4e4e4] disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              onClick={submit}
              disabled={saving || deleting}
              className="text-[11px] px-3 py-1.5 rounded bg-[#3b82f6] text-white hover:bg-[#2f6fe0] disabled:opacity-50"
            >
              {saving ? "Đang lưu…" : "Lưu (reset → PENDING)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}