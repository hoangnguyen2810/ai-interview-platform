"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";
import { CodeProvider, useCode } from "../CodeContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Submission {
  submissionId: string;
  questionId: string | null;
  language: string;
  sourceCode?: string;
  stdout: string;
  stderr?: string;
  runtimeMs: number;
  exitCode?: number;
  status: string;
  success?: boolean;
  createdAt: string;
  candidateName?: string | null;
}

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-GB", { hour12: false });
  } catch {
    return iso;
  }
}

function formatLanguage(lang: string): string {
  const l = (lang || "").toLowerCase();
  if (l === "python") return "Python";
  if (l === "javascript" || l === "js") return "JavaScript";
  if (l === "java") return "Java";
  if (l === "cpp" || l === "c++") return "C++";
  return lang || "—";
}

function statusLabel(status: string): string {
  switch (status) {
    case "ACCEPTED":
    case "SUCCESS":
      return "Executed successfully";
    case "WRONG_ANSWER":
      return "Wrong answer";
    case "COMPILE_ERROR":
      return "Compilation error";
    case "RUNTIME_ERROR":
      return "Runtime error";
    case "TIMEOUT":
      return "Timed out";
    case "SYSTEM_ERROR":
      return "System error";
    case "PENDING":
      return "Pending";
    case "RUNNING":
      return "Running";
    default:
      return status;
  }
}

// ─── Code Viewer Modal ────────────────────────────────────────────────────────

function CodeViewerModal({
  submission,
  onClose,
}: {
  submission: Submission;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="
    bg-[#0a1929]
    border border-cyan-500/30
    rounded-xl
    w-[95vw]
    max-w-6xl
    h-[90vh]
    flex flex-col
    shadow-2xl
    overflow-hidden
  "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20 bg-[#122131] rounded-t-xl">
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-cyan-400">
              code
            </span>
            <div className="min-w-0">
              <h3 className="text-white font-semibold text-sm truncate">
                Source code đã nộp
              </h3>
              <p className="text-white/40 text-[11px] truncate">
                Submission #{submission.submissionId.slice(0, 8)} •{" "}
                {formatLanguage(submission.language)} •{" "}
                {formatTime(submission.createdAt)}
                {submission.candidateName &&
                  ` • bởi ${submission.candidateName}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors p-1"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Code body */}
        <div className="flex-1 overflow-hidden bg-[#0d1c2d]">
          {submission.sourceCode ? (
            <Editor
              language={submission.language}
              height="100%"
              theme="vs-dark"
              value={submission.sourceCode}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                tabSize: 4,
                wordWrap: "on",
                padding: { top: 12, bottom: 12 },
                lineNumbers: "on",
                renderLineHighlight: "none",
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-white/40 text-sm">
              Submission này không có source code được lưu.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-cyan-500/20 bg-[#122131] text-[11px] text-white/50 rounded-b-xl">
          <span>{submission.sourceCode?.length ?? 0} ký tự</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Submission block (formatted as requested) ────────────────────────────────

function SubmissionBlock({
  index,
  submission,
  onViewCode,
}: {
  index: number;
  submission: Submission;
  onViewCode: (submission: Submission) => void;
}) {
  return (
    <div className="bg-[#0a1929] border border-cyan-500/20 rounded-lg p-4 font-mono text-xs text-white/80 whitespace-pre-wrap leading-relaxed">
      <div className="flex items-center justify-between mb-1">
        <div className="text-cyan-400 font-bold text-sm">
          Submission #{index}
        </div>
        <button
          type="button"
          onClick={() => onViewCode(submission)}
          className="px-2.5 py-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] font-semibold transition-colors flex items-center gap-1"
          title="Xem source code của submission này"
        >
          <span className="material-symbols-outlined text-xs leading-none">
            code
          </span>
          Xem code
        </button>
      </div>
      <div className="text-white/40">-------------------------</div>
      <div>
        <span className="text-white/50">Time:</span>{" "}
        <span className="text-white">{formatTime(submission.createdAt)}</span>
      </div>
      <div className="h-2" />
      <div>
        <span className="text-white/50">Language:</span>{" "}
        <span className="text-white">
          {formatLanguage(submission.language)}
        </span>
      </div>
      <div className="h-2" />
      <div>
        <span className="text-white/50">Status:</span>
      </div>
      <div className="text-green-400">✓ {statusLabel(submission.status)}</div>
      <div className="h-2" />
      <div>
        <span className="text-white/50">Output:</span>
      </div>
      <div className="text-white/90">
        {submission.stdout?.trim() ? submission.stdout.trim() : "(no output)"}
      </div>
      <div className="h-2" />
      <div>
        <span className="text-white/50">Runtime:</span>
      </div>
      <div className="text-white">{submission.runtimeMs ?? 0} ms</div>
      {submission.candidateName && (
        <>
          <div className="h-2" />
          <div className="text-white/40 text-[11px]">
            by {submission.candidateName}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Editor view ──────────────────────────────────────────────────────────────

function RecruiterCodingEditor({ meetingCode }: { meetingCode: string }) {
  const { code, language, isConnected } = useCode();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tab, setTab] = useState<"output" | "history">("output");
  const [outputHeight, setOutputHeight] = useState(288); // 72 = 288px
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(
    null,
  );
  const resizing = useRef(false);

  const startResize = (e: React.MouseEvent<HTMLDivElement>) => {
    resizing.current = true;

    const startY = e.clientY;
    const startHeight = outputHeight;

    const onMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return;

      const diff = startY - e.clientY;

      setOutputHeight(
        Math.min(Math.max(startHeight + diff, 160), window.innerHeight * 0.7),
      );
    };

    const onMouseUp = () => {
      resizing.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // ─── Subscribe to live submission events ──────────────────────────────────
  useEffect(() => {
    const s = io(SOCKET_URL, {
      query: { meetingCode },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    s.on("submission:added", (payload: Submission) => {
      console.log(`[RecruiterCodingView] submission:added`, payload);
      setSubmissions((prev) => {
        if (prev.some((p) => p.submissionId === payload.submissionId))
          return prev;
        // Insert newest at the top (descending by createdAt)
        return [payload, ...prev];
      });
      // auto-switch to history tab when a new submission arrives
      setTab("history");
    });

    return () => {
      s.disconnect();
    };
  }, [meetingCode]);

  // ─── Initial fetch of all submissions ─────────────────────────────────────
  const loadSubmissions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/submissions`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = await res.json();
      const list: Submission[] = (data.submissions ?? [])
        .map(
          (s: {
            submissionId: string;
            questionId: string | null;
            language: string;
            status: string;
            runtimeMs: number;
            createdAt: string;
            candidateName: string | null;
            stdout?: string;
            stderr?: string;
            exitCode?: number;
          }) => ({
            submissionId: s.submissionId,
            questionId: s.questionId,
            language: s.language,
            status: s.status,
            runtimeMs: s.runtimeMs ?? 0,
            stdout: s.stdout ?? "",
            stderr: s.stderr ?? "",
            exitCode: s.exitCode,
            createdAt: s.createdAt,
            candidateName: s.candidateName,
          }),
        )
        // Sort newest first
        .sort(
          (a: Submission, b: Submission) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      setSubmissions(list);
    } catch {
      // silent — recruiter will see live ones only
    }
  }, [meetingCode]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  return (
    <div className="w-full h-full flex flex-col bg-[#071524] rounded-xl overflow-hidden border border-cyan-500/20">
      {/* HEADER */}
      <div className="h-12 px-5 flex items-center justify-between bg-[#0c1b2c] border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-cyan-400">code</span>

          <span className="font-semibold text-white">Live Coding</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs ${isConnected ? "text-green-400 animate-pulse" : "text-red-400"}`}
          >
            {isConnected ? "● Đã kết nối..." : "○ Mất kết nối"}
          </span>
          <span className="px-2 py-1 rounded-md bg-cyan-500/10 text-cyan-300 text-[11px]">
            {formatLanguage(language)}
          </span>

          <span className="px-2 py-1 rounded-md bg-white/5 text-white/50 text-[11px]">
            Read only
          </span>
        </div>
      </div>

      {/* CODE EDITOR (read-only for recruiter) */}
      <div className="flex-1 overflow-hidden bg-[#0d1c2d]">
        <Editor
          language={language}
          height="100%"
          theme="vs-dark"
          value={code || "// Đang chờ ứng viên bắt đầu viết mã..."}
          onChange={() => {}} // read-only
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 15,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            tabSize: 4,
            wordWrap: "on",
            padding: { top: 16 },
            lineNumbers: "on",
            renderLineHighlight: "none",
          }}
        />
      </div>
      <div
        onMouseDown={startResize}
        className="h-1 cursor-row-resize bg-cyan-500/10 hover:bg-cyan-400 transition-colors"
      />

      {/* OUTPUT PANEL */}
      <div
        style={{ height: outputHeight }}
        className="border-t border-white/5 bg-[#0d1b2a] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/5 bg-[#101d2d]">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTab("output")}
              className={`px-4 h-8 rounded-lg text-sm font-medium transition ${
                tab === "output"
                  ? "bg-cyan-500/15 text-cyan-400"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              Output
            </button>

            <button
              onClick={() => setTab("history")}
              className={`px-4 h-8 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                tab === "history"
                  ? "bg-cyan-500/15 text-cyan-400"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              Lịch sử
              <span
                className={`text-[10px] rounded-full px-2 py-0.5 ${
                  submissions.length
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "bg-white/10 text-white/40"
                }`}
              >
                {submissions.length}
              </span>
            </button>
          </div>

          {tab === "output" && (
            <span className="text-[11px] text-white/40">
              Live Coding Monitor
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {tab === "output" ? (
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl bg-[#122131] border border-white/5 p-4">
                <div className="text-[11px] uppercase tracking-wide text-white/40">
                  Trạng thái
                </div>
                <div className="mt-2 font-semibold">
                  {code ? (
                    <span className="text-green-400">● Nhận Code</span>
                  ) : (
                    <span className="text-yellow-400">Chờ...</span>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-[#122131] border border-white/5 p-4">
                <div className="text-[11px] uppercase tracking-wide text-white/40">
                  Số ký tự
                </div>

                <div className="mt-2 text-xl font-bold text-white">
                  {code.length.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl bg-[#122131] border border-white/5 p-4">
                <div className="text-[11px] uppercase tracking-wide text-white/40">
                  Bài nộp
                </div>

                <div className="mt-2 text-xl font-bold text-cyan-400">
                  {submissions.length}
                </div>
              </div>
            </div>
          ) : submissions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/40">
              <span className="material-symbols-outlined text-5xl opacity-20 mb-3">
                history
              </span>

              <p>Chưa có bài nộp.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((s, idx) => (
                <SubmissionBlock
                  key={s.submissionId}
                  index={submissions.length - idx}
                  submission={s}
                  onViewCode={setViewingSubmission}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div className="h-8 px-3 flex items-center justify-between border-t border-cyan-500/10 bg-[#0f1f30] text-[11px] text-white/50">
        <span>
          solution.
          {language === "python"
            ? "py"
            : language === "java"
              ? "java"
              : language === "cpp"
                ? "cpp"
                : "js"}
        </span>

        <span>Socket.IO</span>
      </div>

      {/* Code viewer modal (mở khi click "Xem code" trên 1 submission) */}
      {viewingSubmission && (
        <CodeViewerModal
          submission={viewingSubmission}
          onClose={() => setViewingSubmission(null)}
        />
      )}
    </div>
  );
}

// ─── Wrapper with CodeProvider ────────────────────────────────────────────────

interface Props {
  meetingCode: string;
}

export default function RecruiterCodingView({ meetingCode }: Props) {
  return (
    <CodeProvider meetingCode={meetingCode} isSender={false}>
      <RecruiterCodingEditor meetingCode={meetingCode} />
    </CodeProvider>
  );
}
