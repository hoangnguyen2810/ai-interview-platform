"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Shared cam/mic state across Waiting Room → Meeting Room navigation.
 *
 * Lives at /interview/* layout level so it persists across page navigations
 * (same Next.js layout segment).
 *
 * Two-way sync:
 * - Waiting Room toggles write → sessionStorage → Meeting Room reads on mount
 * - Meeting Room toggles write → sessionStorage → Waiting Room reads on poll
 *
 * Also reads persisted SDK state from sessionStorage so cam/mic reflect the
 * last toggled value even after hard refresh in the meeting room.
 */

export interface CamMicSyncValue {
  cameraEnabled: boolean;
  micEnabled: boolean;
  setCameraEnabled: (v: boolean) => void;
  setMicEnabled: (v: boolean) => void;
  /** Read persisted SDK state (set by FooterControls when toggling in meeting room) */
  readPersisted: () => { camera: boolean; mic: boolean };
}

const CamMicSyncContext = createContext<CamMicSyncValue | null>(null);

const SESSION_CAM = "meeting_cam";
const SESSION_MIC = "meeting_mic";

function readSession(): { camera: boolean; mic: boolean } {
  if (typeof window === "undefined") return { camera: true, mic: true };
  return {
    camera: sessionStorage.getItem(SESSION_CAM) !== "false",
    mic: sessionStorage.getItem(SESSION_MIC) !== "false",
  };
}

export function CamMicSyncProvider({ children }: { children: ReactNode }) {
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  // Init from sessionStorage (set by waiting room OR by meeting room on hard-refresh)
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const saved = readSession();
    setCameraEnabled(saved.camera);
    setMicEnabled(saved.mic);
  }, []);

  const handleSetCamera = useCallback((v: boolean) => {
    sessionStorage.setItem(SESSION_CAM, String(v));
    setCameraEnabled(v);
  }, []);

  const handleSetMic = useCallback((v: boolean) => {
    sessionStorage.setItem(SESSION_MIC, String(v));
    setMicEnabled(v);
  }, []);

  const readPersisted = useCallback((): { camera: boolean; mic: boolean } => {
    return readSession();
  }, []);

  const value = useMemo<CamMicSyncValue>(
    () => ({
      cameraEnabled,
      micEnabled,
      setCameraEnabled: handleSetCamera,
      setMicEnabled: handleSetMic,
      readPersisted,
    }),
    [cameraEnabled, micEnabled, handleSetCamera, handleSetMic, readPersisted],
  );

  return (
    <CamMicSyncContext.Provider value={value}>
      {children}
    </CamMicSyncContext.Provider>
  );
}

export function useCamMicSync(): CamMicSyncValue {
  const ctx = useContext(CamMicSyncContext);
  if (!ctx) {
    throw new Error("useCamMicSync must be used inside <CamMicSyncProvider>");
  }
  return ctx;
}
