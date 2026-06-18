import { requireInterviewAccess } from "@/lib/interview-guard";
import InterviewWaitingClient from "./InterviewWaitingClient";

interface PageProps {
  params: Promise<{ meetingCode: string }>;
}

export default async function InterviewWaitingPage({ params }: PageProps) {
  const { meetingCode } = await params;
  const access = await requireInterviewAccess(meetingCode);

  return (
    <InterviewWaitingClient
      meetingCode={access.meetingCode}
      title={access.title}
      participantRole={access.participantRole}
    />
  );
}
