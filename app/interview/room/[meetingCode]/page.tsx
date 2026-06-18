import { requireInterviewAccess } from "@/lib/interview-guard";
import InterviewRoomClient from "./InterviewRoomClient";

interface PageProps {
  params: Promise<{ meetingCode: string }>;
}

export default async function InterviewRoomPage({ params }: PageProps) {
  const { meetingCode } = await params;
  const access = await requireInterviewAccess(meetingCode);

  return (
    <InterviewRoomClient
      meetingCode={access.meetingCode}
      title={access.title}
      participantRole={access.participantRole}
    />
  );
}
