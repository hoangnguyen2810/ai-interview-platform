"use client";

import { createContext, useCallback, useContext, useRef } from "react";
import type { CreatedInterview } from "./CreateInterviewModal";

export type { CreatedInterview };

type Listener = (interview: CreatedInterview) => void;
type FinishedListener = (interviewId: string) => void;

interface DashboardContextValue {
  /** HeroSection (modal) gọi khi server trả 201. */
  notifyInterviewCreated: (interview: CreatedInterview) => void;
  /** UpcomingInterviews (hoặc các card khác) gọi để lắng nghe. */
  subscribeInterviewCreated: (cb: Listener) => () => void;
  /**
   * Khi HOST bấm End Call, InterviewRoom gọi để các component khác
   * (RecentInterviews, UpcomingInterviews) refresh data.
   */
  notifyInterviewFinished: (interviewId: string) => void;
  subscribeInterviewFinished: (cb: FinishedListener) => () => void;
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
  const finishedListenersRef = useRef<Set<FinishedListener>>(new Set());

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

  const subscribeInterviewFinished = useCallback((cb: FinishedListener) => {
    finishedListenersRef.current.add(cb);
    return () => {
      finishedListenersRef.current.delete(cb);
    };
  }, []);

  const notifyInterviewFinished = useCallback((interviewId: string) => {
    finishedListenersRef.current.forEach((cb) => {
      try {
        cb(interviewId);
      } catch (err) {
        console.error("interview finished listener error:", err);
      }
    });
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        notifyInterviewCreated,
        subscribeInterviewCreated,
        notifyInterviewFinished,
        subscribeInterviewFinished,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
