"use client";

import { useRef, useState, useCallback } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { useQuestions } from "../QuestionContext";
import { CodeProvider, useCode } from "../CodeContext";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Status Badge Component ──────────────────────────────────────────────────

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

// ─── Main Editor Component ───────────────────────────────────────────────────

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

  // ─── State ────────────────────────────────────────────────────────────────
  const [stdin, setStdin] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [activeTab, setActiveTab] = useState<"testcase" | "result">("testcase");

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  // ─── Handlers ────────────────────────────────────────────────────────────
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
    setActiveTab("result");

    try {
      const response = await fetch("/api/sandbox/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          stdin,
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
  }, [code, language, stdin, meetingCode, activeQuestion?.id]);

  const question = activeQuestion;

  return (
    <div className="w-full h-full flex bg-[#071524] rounded-xl overflow-hidden border border-cyan-500/20">
      {/* LEFT SIDE */}
      <div className="flex-[4] flex flex-col border-r border-cyan-500/10">
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

        {/* OUTPUT */}
        <div className="h-56 border-t border-cyan-500/10 bg-[#0d1c2d]">
          <div className="flex items-center justify-between px-4 border-b border-cyan-500/10">
            {/* TABS */}
            <div className="flex items-center">
              <button
                onClick={() => setActiveTab("testcase")}
                className={`px-4 py-3 text-sm transition-colors ${
                  activeTab === "testcase"
                    ? "text-cyan-400 border-b-2 border-cyan-400"
                    : "text-white/50 hover:text-cyan-300"
                }`}
              >
                Testcase
              </button>

              <button
                onClick={() => setActiveTab("result")}
                className={`px-4 py-3 text-sm transition-colors flex items-center gap-2 ${
                  activeTab === "result"
                    ? "text-cyan-400 border-b-2 border-cyan-400"
                    : "text-white/50 hover:text-cyan-300"
                }`}
              >
                Test Result
                {result && (
                  <StatusBadge status={result.status} />
                )}
              </button>
            </div>

            {/* ACTIONS */}
            <div className="flex items-center gap-3">
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

              <button className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#051424] font-semibold text-sm transition-colors">
                Submit
              </button>
            </div>
          </div>

          {/* CONTENT */}
          <div className="p-4 h-32 overflow-auto">
            {activeTab === "testcase" ? (
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Enter input for your code (optional)..."
                className="w-full h-full bg-[#122131] border border-cyan-500/10 focus:border-cyan-400 rounded-lg p-3 text-white resize-none outline-none placeholder-white/30"
              />
            ) : (
              <div className="space-y-2">
                {isRunning ? (
                  <div className="flex items-center gap-2 text-blue-400">
                    <span className="animate-spin">⚙</span>
                    <span>Executing code in sandbox...</span>
                  </div>
                ) : result ? (
                  <>
                    {/* Runtime info */}
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

                    {/* Stdout */}
                    {result.stdout && (
                      <div>
                        <p className="text-xs text-green-400 mb-1">Output:</p>
                        <pre className="text-sm text-white/90 bg-[#0a1929] rounded p-2 overflow-x-auto">
                          {result.stdout}
                        </pre>
                      </div>
                    )}

                    {/* Stderr */}
                    {result.stderr && (
                      <div>
                        <p className="text-xs text-red-400 mb-1">Error:</p>
                        <pre className="text-sm text-red-300 bg-[#1a0a0a] rounded p-2 overflow-x-auto">
                          {result.stderr}
                        </pre>
                      </div>
                    )}

                    {/* No output */}
                    {!result.stdout && !result.stderr && (
                      <p className="text-white/50 text-sm">No output</p>
                    )}
                  </>
                ) : (
                  <p className="text-white/50 text-sm">
                    Click "Run" to execute your code
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex-[5] flex flex-col">
        {/* EDITOR HEADER */}
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
            <span
              className={`text-xs ${isConnected ? "text-green-400" : "text-red-400"}`}
            >
              {isConnected ? "● Live" : "○ Disconnected"}
            </span>
            <button
              className="hover:text-cyan-400 transition-colors"
              title="Settings"
            >
              ⚙
            </button>
            <button
              className="hover:text-cyan-400 transition-colors"
              title="Fullscreen"
            >
              ⛶
            </button>
          </div>
        </div>

        {/* EDITOR */}
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

// ─── Wrapper with CodeProvider ────────────────────────────────────────────────

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
