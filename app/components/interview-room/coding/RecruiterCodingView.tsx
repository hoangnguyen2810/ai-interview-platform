"use client";

import Editor from "@monaco-editor/react";
import { CodeProvider, useCode } from "../CodeContext";

function RecruiterCodingEditor({ meetingCode }: { meetingCode: string }) {
  const { code, language, isConnected, setCode } = useCode();

  return (
    <div className="w-full h-full flex flex-col bg-[#071524] rounded-xl overflow-hidden border border-cyan-500/20">
      {/* HEADER */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-cyan-500/10 bg-[#122131]">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-medium">Live Coding</h3>

          <span className="px-2 py-0.5 text-xs rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            {language === "python" ? "Python3" : language === "java" ? "Java" : language === "cpp" ? "C++" : "JavaScript"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-xs ${isConnected ? "text-green-400 animate-pulse" : "text-red-400"}`}>
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

      {/* OUTPUT PANEL */}
      <div className="h-44 border-t border-cyan-500/10 bg-[#122131]">
        {/* Tabs */}
        <div className="flex items-center border-b border-cyan-500/10">
          <button className="px-4 py-3 text-cyan-400 border-b-2 border-cyan-400 text-sm">
            Output
          </button>

          <button className="px-4 py-3 text-white/50 hover:text-cyan-300 text-sm transition-colors">
            History
          </button>
        </div>

        {/* Content */}
        <div className="p-4 text-sm">
          <div className="flex items-center gap-2 text-yellow-400 mb-3">
            <span>○ Watching candidate code in real-time</span>
          </div>

          <div className="space-y-2 text-white/70">
            <div>Status: {code ? "Code received" : "No code yet"}</div>
            <div>Characters: {code.length}</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="h-10 flex items-center justify-between px-4 border-t border-cyan-500/10 bg-[#0f1f30] text-xs text-white/50">
        <span>solution.{language === "python" ? "py" : language === "java" ? "java" : language === "cpp" ? "cpp" : "js"}</span>

        <div className="flex items-center gap-4">
          <span>Real-time sync via Socket.IO</span>
        </div>
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
