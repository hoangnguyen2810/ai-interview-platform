"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface ExecResult {
  exitCode: number | null;
  runtimeMs: number | null;
  memoryKb: number | null;
  stdin: string;
}

interface CodeTerminalProps {
  sessionId: string;
  wsUrl: string;
  code: string;
  language: string;
  onExit?: (result: ExecResult) => void;
}

export default function CodeTerminal({
  sessionId,
  wsUrl,
  code,
  language,
  onExit,
}: CodeTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#0a1929",
        foreground: "#e5e7eb",
        cursor: "#22d3ee",
      },
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    const ws = new WebSocket(
      `${wsUrl}?sessionId=${encodeURIComponent(sessionId)}`,
    );
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "init", code, language }));
      ws.send(
        JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }),
      );
    };

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          console.log("[CodeTerminal] control message:", msg);
          if (msg.type === "exit") {
            onExit?.({
              exitCode: msg.code,
              runtimeMs: msg.runtimeMs ?? null,
              memoryKb: msg.memoryKb ?? null,
              stdin: msg.stdin ?? "",
            });
          } else if (msg.type === "error") {
            term.write(`\r\n\x1b[31m[Lỗi sandbox: ${msg.message}]\x1b[0m\r\n`);
            onExit?.({
              exitCode: null,
              runtimeMs: null,
              memoryKb: null,
              stdin: "",
            });
          }
        } catch {
          term.write(event.data);
        }
      } else {
        term.write(new Uint8Array(event.data));
      }
    };

    ws.onerror = () => {
      term.write("\r\n[Mất kết nối tới sandbox]\r\n");
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    const handleResize = () => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }),
        );
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      ws.close();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, wsUrl]);

  return <div ref={containerRef} className="w-full h-full" />;
}
