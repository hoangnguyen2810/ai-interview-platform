import { MediaProvider } from "@/app/components/interview-room/MediaContext";
import { requireInterviewAccess } from "@/lib/interview-guard";
import InterviewWaitingClient from "./InterviewWaitingClient";
import PasswordGate from "@/app/components/interview-room/PasswordGate";

interface PageProps {
  params: Promise<{ meetingCode: string }>;
}

export default async function InterviewWaitingPage({ params }: PageProps) {
  const { meetingCode } = await params;
  const access = await requireInterviewAccess(meetingCode);

  if (access.passwordRequired) {
    return (
      <PasswordGate
        meetingCode={access.meetingCode}
        title={access.title}
        redirectPath={`/interview/waiting/${access.meetingCode}`}
      />
    );
  }

  return (
    <MediaProvider>
      <InterviewWaitingClient
        meetingCode={access.meetingCode}
        title={access.title}
        participantRole={access.participantRole}
      />
    </MediaProvider>
  );
}