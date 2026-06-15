"use client";

import { createContext, useCallback, useContext, useRef } from "react";

export interface CreatedInterview {
  id: string;
  title: string;
  description: string | null;
  meetingCode: string;
  roomPassword: string | null;
  allowGuest: boolean;
  maxParticipants: number;
  maxInterviewers: 2 | 3;
  durationMinutes: 30 | 60 | 90 | 120;
  status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";
  scheduledAt: string; // ISO
  createdAt: string;
}

type Listener = (interview: CreatedInterview) => void;

interface DashboardContextValue {
  /** HeroSection (modal) gọi khi server trả 201. */
  notifyInterviewCreated: (interview: CreatedInterview) => void;
  /** UpcomingInterviews (hoặc các card khác) gọi để lắng nghe. */
  subscribeInterviewCreated: (cb: Listener) => () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useRecruiterDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error(
      "useRecruiterDashboard phải được dùng bên trong <RecruiterDashboardProvider>",
    );
  }
  return ctx;
}

export function RecruiterDashboardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const listenersRef = useRef<Set<Listener>>(new Set());

  const subscribeInterviewCreated = useCallback((cb: Listener) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  const notifyInterviewCreated = useCallback(
    (interview: CreatedInterview) => {
      listenersRef.current.forEach((cb) => {
        try {
          cb(interview);
        } catch (err) {
          console.error("interview listener error:", err);
        }
      });
    },
    [],
  );

  return (
    <DashboardContext.Provider
      value={{ notifyInterviewCreated, subscribeInterviewCreated }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
