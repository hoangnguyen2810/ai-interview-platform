import { redirect } from "next/navigation";
import { getAuthedUser, findInterviewByMeetingCode } from "@/lib/interview-guard";

interface PageProps {
  params: Promise<{ meetingCode: string }>;
}

/**
 * /join/[meetingCode] — landing cho candidate nhập meeting code
 * - Chưa đăng nhập → /login?next=<meetingCode>
 * - Code không tồn tại → /login
 * - OK → redirect /interview/waiting/[meetingCode]
 */
export default async function JoinInterviewPage({ params }: PageProps) {
  const { meetingCode } = await params;
  const user = await getAuthedUser();

  if (!user) {
    redirect(`/login?next=/join/${encodeURIComponent(meetingCode)}`);
  }

  const interview = await findInterviewByMeetingCode(meetingCode);
  if (!interview) {
    redirect("/login?error=invalid_meeting_code");
  }

  redirect(`/interview/waiting/${encodeURIComponent(meetingCode)}`);
}
