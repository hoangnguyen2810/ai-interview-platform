"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { useQuestions } from "../QuestionContext";
import { CodeProvider, useCode } from "../CodeContext";

interface ExecutionResult {
  executionId: string;
  status: string;
  stdout: string;
  stderr: string;
  runtimeMs: number;
  exitCode: number;
  success: boolean;
  error?: string;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-yellow-500/20 text-yellow-400",
    RUNNING: "bg-blue-500/20 text-blue-400 animate-pulse",
    SUCCESS: "bg-green-500/20 text-green-400",
    TIMEOUT: "bg-orange-500/20 text-orange-400",
    COMPILE_ERROR: "bg-red-500/20 text-red-400",
    RUNTIME_ERROR: "bg-red-500/20 text-red-400",
    SYSTEM_ERROR: "bg-gray-500/20 text-gray-400",
  };

  const icons: Record<string, string> = {
    PENDING: "⏳",
    RUNNING: "⚙️",
    SUCCESS: "✓",
    TIMEOUT: "⏱️",
    COMPILE_ERROR: "⚠️",
    RUNTIME_ERROR: "⚠️",
    SYSTEM_ERROR: "❌",
  };

  return (
    <span
      className={`text-xs px-2 py-1 rounded-full font-medium ${
        styles[status] || "bg-gray-500/20 text-gray-400"
      }`}
    >
      {icons[status] || "?"} {status}
    </span>
  );
}

function CandidateCodingEditor({ meetingCode }: { meetingCode: string }) {
  const { activeQuestion } = useQuestions();
  const {
    code,
    language,
    isConnected,
    setCode,
    setLanguage,
    setCursorPosition,
  } = useCode();

  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [outputHeight, setOutputHeight] = useState(224); // ~ h-56
  const isResizing = useRef(false);

  const handleMouseDown = () => {
    isResizing.current = true;
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;

    const container = document.getElementById("left-panel");
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const newHeight = rect.bottom - e.clientY;

    if (newHeight >= 120 && newHeight <= 500) {
      setOutputHeight(newHeight);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;

    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position.lineNumber, e.position.column);
    });
  };

  const handleRun = useCallback(async () => {
    if (!code.trim()) return;

    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch("/api/sandbox/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          stdin: "",
          meetingCode,
          questionId: activeQuestion?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          executionId: data.executionId || "",
          status: "SYSTEM_ERROR",
          stdout: "",
          stderr: data.error || "Execution failed",
          runtimeMs: 0,
          exitCode: -1,
          success: false,
          error: data.details,
        });
      } else {
        setResult(data);
      }
    } catch (error) {
      setResult({
        executionId: "",
        status: "SYSTEM_ERROR",
        stdout: "",
        stderr: error instanceof Error ? error.message : "Network error",
        runtimeMs: 0,
        exitCode: -1,
        success: false,
        error: "Failed to connect to execution service",
      });
    } finally {
      setIsRunning(false);
    }
  }, [code, language, meetingCode, activeQuestion?.id]);

  const handleSubmit = useCallback(async () => {
    if (!code.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/submissions`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            language,
            stdin: "",
            questionId: activeQuestion?.id,
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        setSubmitted(true);
        if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = setTimeout(
          () => setSubmitted(false),
          4000,
        );
      } else {
        alert(data.message || "Submit thất bại");
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? `Lỗi kết nối: ${error.message}`
          : "Lỗi kết nối",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [code, language, meetingCode, activeQuestion?.id, isSubmitting]);

  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
    };
  }, []);

  const question = activeQuestion;

  return (
    <div className="w-full h-full flex bg-[#071524] rounded-xl overflow-hidden border border-cyan-500/20 relative">
      {/* ── Submitted notification banner ── */}
      {submitted && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500/15 border border-green-500/40 text-green-300 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-green-400">check_circle</span>
          <div>
            <p className="font-semibold text-sm">Đã submit code thành công</p>
            <p className="text-xs text-green-300/70">
              Recruiter đã nhận được bài làm của bạn.
            </p>
          </div>
        </div>
      )}
      {/* LEFT SIDE */}
      <div
        id="left-panel"
        className="flex-[4] flex flex-col border-r border-cyan-500/10"
      >
        {/* QUESTION */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {!question ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <span className="material-symbols-outlined text-5xl text-gray-600">
                pending_actions
              </span>
              <p className="text-gray-500 text-sm">
                Đang chờ recruiter giao câu hỏi...
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {question.title}
                </h3>

                {question.difficulty && (
                  <span
                    className={`
                      text-xs px-2 py-0.5 rounded-full font-semibold
                      ${
                        question.difficulty === "EASY"
                          ? "bg-green-500/10 text-green-400"
                          : question.difficulty === "MEDIUM"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-red-500/10 text-red-400"
                      }
                    `}
                  >
                    {question.difficulty}
                  </span>
                )}
              </div>

              <p className="text-white/80 leading-7 whitespace-pre-wrap">
                {question.description}
              </p>
            </>
          )}
        </div>

        <div
          onMouseDown={handleMouseDown}
          className="h-1 cursor-row-resize bg-cyan-500/20 hover:bg-cyan-400 transition"
        ></div>

        {/* OUTPUT */}
        <div
          style={{ height: outputHeight }}
          className="border-t border-cyan-500/10 bg-[#0d1c2d] flex flex-col"
        >
          <div className="flex items-center justify-between px-4 border-b border-cyan-500/10">
            <div className="flex items-center">
              <button className="px-4 py-3 text-sm text-cyan-400 border-b-2 border-cyan-400">
                Output
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRun}
                disabled={isRunning || !code.trim()}
                className="px-4 py-1.5 rounded-lg bg-[#16304b] hover:bg-[#1e3a5f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRunning ? (
                  <>
                    <span className="animate-spin">⚙</span>
                    Running...
                  </>
                ) : (
                  "Run"
                )}
              </button>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !code.trim() || submitted}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#051424] font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin">⚙</span>
                    Submitting...
                  </>
                ) : submitted ? (
                  <>
                    <span>✓</span>
                    Submitted
                  </>
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
            {isRunning ? (
              <div className="flex items-center gap-2 text-blue-400">
                <span className="animate-spin">⚙</span>
                <span>Thực thi mã trong môi trường (sandbox)...</span>
              </div>
            ) : result ? (
              <>
                <div className="flex items-center gap-4 text-xs text-white/50 mb-2">
                  <span>
                    Status: <StatusBadge status={result.status} />
                  </span>
                  {result.runtimeMs > 0 && (
                    <span>Runtime: {result.runtimeMs}ms</span>
                  )}
                  {result.exitCode !== undefined && (
                    <span>Exit code: {result.exitCode}</span>
                  )}
                </div>

                {result.stdout && (
                  <div>
                    <p className="text-xs text-green-400 mb-1">Output:</p>
                    <pre className="text-sm text-white/90 bg-[#0a1929] rounded p-2 overflow-x-auto">
                      {result.stdout}
                    </pre>
                  </div>
                )}

                {result.stderr && (
                  <div>
                    <p className="text-xs text-red-400 mb-1">Error:</p>
                    <pre className="text-sm text-red-300 bg-[#1a0a0a] rounded p-2 overflow-x-auto">
                      {result.stderr}
                    </pre>
                  </div>
                )}

                {!result.stdout && !result.stderr && (
                  <p className="text-white/50 text-sm">No output</p>
                )}
              </>
            ) : (
              <p className="text-white/50 text-sm">
                Nhấn "Run" để thực thi mã của bạn.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex-[5] flex flex-col">
        <div className="h-11 flex items-center justify-between px-4 border-b border-cyan-500/10 bg-[#122131]">
          <span className="text-sm text-white/70">
            solution.
            {language === "python"
              ? "py"
              : language === "java"
                ? "java"
                : language === "cpp"
                  ? "cpp"
                  : "js"}
          </span>

          <div className="flex items-center gap-3 text-white/50">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-[#122131] border border-cyan-500/10 text-white px-3 py-1.5 rounded-lg text-sm"
            >
              <option value="python">Python3</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="javascript">JavaScript</option>
            </select>

            <span
              className={`text-xs ${
                isConnected ? "text-green-400" : "text-red-400"
              }`}
            >
              {isConnected ? "● Live" : "○ Disconnected"}
            </span>

            <button className="hover:text-cyan-400 transition-colors">⚙</button>
            <button className="hover:text-cyan-400 transition-colors">⛶</button>
          </div>
        </div>

        <div className="flex-1 bg-[#0d1c2d]">
          <Editor
            language={language}
            height="100%"
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value || "")}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 15,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              tabSize: 4,
              wordWrap: "on",
              padding: { top: 16 },
              lineNumbers: "on",
            }}
          />
        </div>
      </div>
    </div>
  );
}

interface Props {
  meetingCode: string;
}

export default function CandidateCodingView({ meetingCode }: Props) {
  return (
    <CodeProvider meetingCode={meetingCode} isSender={true}>
      <CandidateCodingEditor meetingCode={meetingCode} />
    </CodeProvider>
  );
}
