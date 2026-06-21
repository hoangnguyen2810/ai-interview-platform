"use client";

import {
  useCallStateHooks,
  hasAudio,
  hasVideo,
} from "@stream-io/video-react-sdk";
import { useEffect, useState } from "react";

export type Participant = {
  id: string;
  name: string;
  roleLabel: string;
  micOn: boolean;
  cameraOn: boolean;
  isYou: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  userFullName: string;
  currentUserRole: "candidate" | "recruiter";
  participantRole: "CANDIDATE" | "HOST" | "CO_HOST";
  meetingCode: string;
};

export default function ParticipantsDrawer({
  open,
  onClose,
  userFullName,
  currentUserRole,
  participantRole,
  meetingCode,
}: Props) {
  const { useRemoteParticipants, useLocalParticipant } = useCallStateHooks();

  const remoteParticipants = useRemoteParticipants();
  const localParticipant = useLocalParticipant();

  const remote = remoteParticipants?.[0];

  const isHost = participantRole === "HOST" || participantRole === "CO_HOST";

  const [otherParticipantName, setOtherParticipantName] = useState<
    string | null
  >(null);

  const [remoteMicOn, setRemoteMicOn] = useState(false);
  const [remoteCamOn, setRemoteCamOn] = useState(false);

  const [mutingMic, setMutingMic] = useState(false);
  const [disablingCam, setDisablingCam] = useState(false);

  // LOCAL STATE
  const localMicOn = localParticipant ? hasAudio(localParticipant) : false;
  const localCamOn = localParticipant ? hasVideo(localParticipant) : false;

  // FETCH OTHER PARTICIPANT NAME
  useEffect(() => {
    if (!open) return;

    const roleLabel =
      currentUserRole === "candidate" ? "Interviewer" : "Candidate";

    const roleParam =
      currentUserRole === "candidate" ? "INTERVIEWER" : "CANDIDATE";

    fetch(`/api/interview-participants?role=${roleParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.participant) {
          const name =
            currentUserRole === "candidate"
              ? data.participant.full_name
              : (data.participant.candidate_name ?? data.participant.full_name);

          setOtherParticipantName(name || roleLabel);
        }
      })
      .catch(() => setOtherParticipantName(roleLabel));
  }, [open, currentUserRole]);

  // SYNC REMOTE STATE — also clear name when remote leaves
  useEffect(() => {
    if (!remote) {
      // Remote left — clear name so they disappear from the list
      setOtherParticipantName(null);
      return;
    }

    setRemoteMicOn(hasAudio(remote));
    setRemoteCamOn(hasVideo(remote));

    // Restore name if we had it cached
    if (!otherParticipantName) {
      const roleLabel =
        currentUserRole === "candidate" ? "Interviewer" : "Candidate";
      const roleParam =
        currentUserRole === "candidate" ? "INTERVIEWER" : "CANDIDATE";

      fetch(`/api/interview-participants?role=${roleParam}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.participant) {
            const name =
              currentUserRole === "candidate"
                ? data.participant.full_name
                : (data.participant.candidate_name ?? data.participant.full_name);
            setOtherParticipantName(name || roleLabel);
          }
        })
        .catch(() => setOtherParticipantName(roleLabel));
    }
  }, [remote, currentUserRole, open]);

  // TOGGLE MIC (HOST ONLY) — uses sessionId
  async function handleToggleMic(sessionId: string | undefined, disable: boolean) {
    if (!sessionId || mutingMic) return;

    setMutingMic(true);
    try {
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/participant-control`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            action: "mute",
            disabled: disable,
          }),
        },
      );

      const data = await res.json();

      if (data.success) {
        setRemoteMicOn(!disable);
      } else {
        console.error("[muteUsers]", data.message);
      }
    } catch (err) {
      console.error("[muteUsers]", err);
    } finally {
      setMutingMic(false);
    }
  }

  // TOGGLE CAMERA (HOST ONLY) — uses sessionId
  async function handleToggleCamera(
    sessionId: string | undefined,
    disable: boolean,
  ) {
    if (!sessionId || disablingCam) return;

    setDisablingCam(true);
    try {
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/participant-control`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            action: "camera",
            disabled: disable,
          }),
        },
      );

      const data = await res.json();

      if (data.success) {
        setRemoteCamOn(!disable);
      } else {
        console.error("[disableCamera]", data.message);
      }
    } catch (err) {
      console.error("[disableCamera]", err);
    } finally {
      setDisablingCam(false);
    }
  }

  const participants: Participant[] = [
    {
      id: "local",
      name: userFullName,
      roleLabel: currentUserRole === "candidate" ? "Candidate" : "Interviewer",
      micOn: localMicOn,
      cameraOn: localCamOn,
      isYou: true,
    },
  ];

  const remoteSessionId = remote?.sessionId;

  // Only show remote participant when they are actually connected
  if (remote && remoteSessionId) {
    participants.push({
      id: remoteSessionId,
      name: otherParticipantName ?? remote.name ?? "Remote",
      roleLabel: currentUserRole === "candidate" ? "Interviewer" : "Candidate",
      micOn: remoteMicOn,
      cameraOn: remoteCamOn,
      isYou: false,
    });
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-screen w-[380px] bg-[#0f1724]
        border-l border-white/10 z-50
        transition-transform duration-300 ease-in-out
        ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="h-16 px-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-white font-medium text-lg">Người tham gia</h2>
            <p className="text-xs text-gray-400">{participants.length} Người</p>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center
            hover:bg-white/10 text-gray-300 transition"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Participants */}
        <div className="overflow-y-auto h-[calc(100vh-64px)]">
          {participants.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between px-5 py-4
              hover:bg-white/5 transition cursor-pointer"
            >
              {/* LEFT */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-cyan-600 flex items-center justify-center text-white font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm">{user.name}</span>

                    {user.isYou && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                        You
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-400">{user.roleLabel}</p>
                    <span className="text-xs text-gray-600">•</span>
                    <p className="text-xs text-gray-400">
                      {user.isYou ? "This device" : "Connected"}
                    </p>
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <div className="flex gap-2">
                {user.isYou ? (
                  <>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        user.micOn ? "bg-white/10" : "bg-red-500/20"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm text-white">
                        {user.micOn ? "mic" : "mic_off"}
                      </span>
                    </div>

                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        user.cameraOn ? "bg-white/10" : "bg-red-500/20"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm text-white">
                        {user.cameraOn ? "videocam" : "videocam_off"}
                      </span>
                    </div>
                  </>
                ) : isHost ? (
                  <>
                    {/* MIC */}
                    <button
                      onClick={() => handleToggleMic(remoteSessionId, remoteMicOn)}
                      disabled={mutingMic}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                        remoteMicOn
                          ? "bg-white/10 hover:bg-red-500/30"
                          : "bg-green-500/30 hover:bg-green-500/50"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm text-white">
                        {remoteMicOn ? "mic" : "mic_off"}
                      </span>
                    </button>

                    {/* CAMERA */}
                    <button
                      onClick={() =>
                        handleToggleCamera(remoteSessionId, remoteCamOn)
                      }
                      disabled={disablingCam}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                        remoteCamOn
                          ? "bg-white/10 hover:bg-red-500/30"
                          : "bg-green-500/30 hover:bg-green-500/50"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm text-white">
                        {remoteCamOn ? "videocam" : "videocam_off"}
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        user.micOn ? "bg-white/10" : "bg-red-500/20"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm text-white">
                        {user.micOn ? "mic" : "mic_off"}
                      </span>
                    </div>

                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        user.cameraOn ? "bg-white/10" : "bg-red-500/20"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm text-white">
                        {user.cameraOn ? "videocam" : "videocam_off"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}

          {isHost && participants.length > 1 && (
            <div className="px-5 py-3">
              <p className="text-[11px] text-gray-500 text-center">
                Host có thể tắt mic / cam của thành viên khác
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
