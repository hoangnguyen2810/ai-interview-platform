/**
 * Layout chung cho toàn bộ segment /interview/*.
 *
 * Mount CamMicSyncProvider để cam/mic state persist giữa
 * Waiting Room → Meeting Room navigation (cùng layout segment).
 *
 * - Waiting Room: dùng CamMicSyncProvider để toggle cam/mic
 * - Meeting Room: đọc persisted state, toggle ghi lại sessionStorage
 */
import { CamMicSyncProvider } from "@/app/components/interview-room/CamMicSyncContext";

export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CamMicSyncProvider>{children}</CamMicSyncProvider>;
}
