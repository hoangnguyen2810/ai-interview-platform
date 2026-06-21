import { requireInterviewAccess } from "@/lib/interview-guard";
import InterviewRoomClient from "./InterviewRoomClient";
import PasswordGate from "@/app/components/interview-room/PasswordGate";

interface PageProps {
  params: Promise<{ meetingCode: string }>;
}

export default async function InterviewRoomPage({ params }: PageProps) {
  const { meetingCode } = await params;
  const access = await requireInterviewAccess(meetingCode);

  if (access.passwordRequired) {
    return (
      <PasswordGate
        meetingCode={access.meetingCode}
        title={access.title}
        redirectPath={`/interview/room/${access.meetingCode}`}
      />
    );
  }

  return (
    <InterviewRoomClient
      meetingCode={access.meetingCode}
      title={access.title}
      participantRole={access.participantRole}
      userFullName={access.userFullName}
      otherParticipantName={access.otherParticipantName}
      userId={access.user.id}
    />
  );
}