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

// ─── Submission block (formatted as requested) ────────────────────────────────

function SubmissionBlock({
  index,
  submission,
}: {
  index: number;
  submission: Submission;
}) {
  return (
    <div className="bg-[#0a1929] border border-cyan-500/20 rounded-lg p-4 font-mono text-xs text-white/80 whitespace-pre-wrap leading-relaxed">
      <div className="text-cyan-400 font-bold text-sm">Submission #{index}</div>
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
      <div className="h-12 flex items-center justify-between px-4 border-b border-cyan-500/10 bg-[#122131]">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-medium">Live Coding</h3>

          <span className="px-2 py-0.5 text-xs rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            {language === "python"
              ? "Python3"
              : language === "java"
                ? "Java"
                : language === "cpp"
                  ? "C++"
                  : "JavaScript"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-xs ${isConnected ? "text-green-400 animate-pulse" : "text-red-400"}`}
          >
            {isConnected ? "● Receiving live code..." : "○ Disconnected"}
          </span>

          <span className="px-2 py-0.5 text-xs rounded-md bg-white/5 text-white/60 border border-white/10">
            Read Only
          </span>
        </div>
      </div>

      {/* CODE EDITOR (read-only for recruiter) */}
      <div className="flex-1 overflow-hidden bg-[#0d1c2d]">
        <Editor
          language={language}
          height="100%"
          theme="vs-dark"
          value={code || "// Waiting for candidate to start coding..."}
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
        className="min-h-40 max-h-[70vh] border-t border-cyan-500/10 bg-[#122131] flex flex-col overflow-hidden"
      >
        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-cyan-500/10">
          <div className="flex items-center">
            <button
              onClick={() => setTab("output")}
              className={`px-4 py-3 text-sm transition-colors ${
                tab === "output"
                  ? "text-cyan-400 border-b-2 border-cyan-400"
                  : "text-white/50 hover:text-cyan-300"
              }`}
            >
              Output
            </button>

            <button
              onClick={() => setTab("history")}
              className={`px-4 py-3 text-sm transition-colors flex items-center gap-2 ${
                tab === "history"
                  ? "text-cyan-400 border-b-2 border-cyan-400"
                  : "text-white/50 hover:text-cyan-300"
              }`}
            >
              History
              {submissions.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                  {submissions.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 text-sm custom-scrollbar">
          {tab === "output" ? (
            <div className="space-y-1 text-white/70">
              <div className="flex justify-between">
                <span className="text-white/50">Status</span>
                <span className="text-green-400">
                  {code ? "Receiving code" : "Waiting..."}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-white/50">Characters</span>
                <span>{code.length}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-white/50">Submissions</span>
                <span>{submissions.length}</span>
              </div>
            </div>
          ) : submissions.length === 0 ? (
            <div className="h-full flex items-center justify-center text-white/40">
              Candidate chưa submit bài nào.
            </div>
          ) : (
            <div className="space-y-2">
              {submissions.map((s, idx) => (
                <SubmissionBlock
                  key={s.submissionId}
                  index={submissions.length - idx}
                  submission={s}
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
