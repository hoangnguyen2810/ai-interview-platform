import { MediaProvider } from "@/app/components/interview-room/MediaContext";

/**
 * Layout chung cho toàn bộ segment /interview/*.
 *
 * Mount MediaProvider ở đây để Waiting Room và Meeting Room
 * cùng chia sẻ một MediaStream duy nhất + camera/mic state.
 *
 * Khi navigate giữa /interview/waiting/[code] ↔ /interview/room/[code],
 * cùng segment cha → provider KHÔNG remount → state được giữ nguyên
 * (camera/mic không bị reset, không gọi getUserMedia lần 2).
 */
export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MediaProvider>{children}</MediaProvider>;
}
