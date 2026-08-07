"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { io, type Socket } from "socket.io-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CodeState {
  code: string;
  language: string;
  cursorLine?: number;
  cursorColumn?: number;
}

export interface CodeContextValue {
  code: string;
  language: string;
  isConnected: boolean;
  setCode: (code: string) => void;
  setLanguage: (lang: string) => void;
  setCursorPosition: (line: number, column: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
const DEBOUNCE_MS = 250; // 250ms debounce — balance between realtime & performance

// ─── Context ──────────────────────────────────────────────────────────────────

const CodeContext = createContext<CodeContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface CodeProviderProps {
  meetingCode: string;
  children: React.ReactNode;
  /** If true, this client sends code changes (candidate side). Default: false (recruiter/receiver) */
  isSender?: boolean;
}

export function CodeProvider({
  meetingCode,
  children,
  isSender = false,
}: CodeProviderProps) {
  const [code, setCodeState] = useState("");
  const [language, setLanguageState] = useState("python");
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const emitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCodeRef = useRef<string>("");
  const isSenderRef = useRef(isSender);

  // Keep ref in sync with prop
  useEffect(() => {
    isSenderRef.current = isSender;
  }, [isSender]);

  // ─── Socket.IO connection ──────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      query: { meetingCode },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log(`[CodeContext] Socket connected: ${socket.id}`);
      setIsConnected(true);

      // Note: no manual sync request needed here. The server keeps the
      // latest code snapshot per meetingCode and emits a code:sync event to
      // this socket automatically as soon as it joins the room (see
      // server.js). That restores the current code for both the candidate
      // (their own in-progress code) and the recruiter (the candidate's
      // code) immediately on reconnect, instead of a blank editor.
    });

    socket.on("connect_error", (err) => {
      console.warn(`[CodeContext] Socket connection error:`, err.message);
      setIsConnected(false);
    });

    socket.on("disconnect", () => {
      console.log(`[CodeContext] Socket disconnected`);
      setIsConnected(false);
    });

    // ── code:update ──────────────────────────────────────────────────────────
    // Receives code changes from candidate in real-time
    socket.on(
      "code:update",
      (payload: {
        code: string;
        language?: string;
        cursorLine?: number;
        cursorColumn?: number;
      }) => {
        // Ignore if WE are the sender — the server relays to everyone in the
        // room including us, and re-applying our own just-typed change would
        // fight with what's currently in the editor / jump the cursor.
        if (isSenderRef.current) return;

        console.log(
          `[CodeContext] code:update received (${payload.code.length} chars)`,
        );
        if (payload.code !== undefined) setCodeState(payload.code);
        if (payload.language) setLanguageState(payload.language);
      },
    );

    // ── code:sync ─────────────────────────────────────────────────────────────
    // Sent once by the server right after this socket joins its room,
    // carrying the last known code for the meeting (see server.js). Unlike
    // code:update, this is NOT filtered by isSender: it's a restore, not a
    // live echo. This is what makes a candidate who closes and reopens the
    // coding panel get their in-progress code back, instead of starting
    // from a blank editor — previously that snapshot was sent over
    // "code:update", which the sender-side guard above silently discarded.
    socket.on(
      "code:sync",
      (payload: {
        code: string;
        language?: string;
        cursorLine?: number;
        cursorColumn?: number;
      }) => {
        console.log(
          `[CodeContext] code:sync received (${payload.code.length} chars)`,
        );
        if (payload.code !== undefined) setCodeState(payload.code);
        if (payload.language) setLanguageState(payload.language);
      },
    );

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
    };
  }, [meetingCode]);

  // ─── Debounced emit ────────────────────────────────────────────────────────
  const emitCodeUpdate = useCallback(
    (newCode: string, lang?: string, line?: number, col?: number) => {
      if (!socketRef.current) return;

      // Clear existing timer
      if (emitTimerRef.current) clearTimeout(emitTimerRef.current);

      pendingCodeRef.current = newCode;

      emitTimerRef.current = setTimeout(() => {
        if (!socketRef.current || !pendingCodeRef.current) return;

        socketRef.current.emit("code:update", {
          code: pendingCodeRef.current,
          language: lang ?? language,
          cursorLine: line,
          cursorColumn: col,
          meetingCode,
        });

        console.log(
          `[CodeContext] Emitted code:update (${pendingCodeRef.current.length} chars)`,
        );
        pendingCodeRef.current = "";
      }, DEBOUNCE_MS);
    },
    [language, meetingCode],
  );

  // ─── Public setters ────────────────────────────────────────────────────────

  const setCode = useCallback(
    (newCode: string) => {
      setCodeState(newCode);
      if (isSender) emitCodeUpdate(newCode);
    },
    [isSender, emitCodeUpdate],
  );

  const setLanguage = useCallback(
    (lang: string) => {
      setLanguageState(lang);
      if (isSender) emitCodeUpdate(code, lang);
    },
    [isSender, code, emitCodeUpdate],
  );

  const setCursorPosition = useCallback(
    (line: number, column: number) => {
      // Throttled cursor position — emit less frequently than code
      if (!isSender || !socketRef.current) return;
      socketRef.current.emit("code:cursor", {
        meetingCode,
        cursorLine: line,
        cursorColumn: column,
      });
    },
    [isSender, meetingCode],
  );

  return (
    <CodeContext.Provider
      value={{
        code,
        language,
        isConnected,
        setCode,
        setLanguage,
        setCursorPosition,
      }}
    >
      {children}
    </CodeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCode(): CodeContextValue {
  const ctx = useContext(CodeContext);
  if (!ctx) throw new Error("useCode must be used within CodeProvider");
  return ctx;
}
