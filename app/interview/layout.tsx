/**
 * Layout chung cho toàn bộ segment /interview/*.
 *
 * KHÔNG mount MediaProvider ở đây nữa — mỗi page tự quản lý.
 *
 * - Waiting Room: tự mount MediaProvider cục bộ cho local camera preview
 *   (getUserMedia trước khi vào call).
 * - Meeting Room: dùng Stream Video SDK, không cần MediaContext.
 */
export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
