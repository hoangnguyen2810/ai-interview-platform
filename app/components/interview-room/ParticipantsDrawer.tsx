"use client";

import {
  useCallStateHooks,
  hasAudio,
  hasVideo,
} from "@stream-io/video-react-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";

type RemoteLike = {
  sessionId?: string;
  userId?: string;
  name?: string;
  customData?: unknown;
  // SDK methods — chỉ dùng qua hasAudio/hasVideo nên không cần định nghĩa đầy đủ
};

export type Participant = {
  sessionId: string;
  dbUserId: string | null;
  name: string;
  roleLabel: "HOST" | "INTERVIEWER" | "CANDIDATE";
  micOn: boolean;
  cameraOn: boolean;
  isYou: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  userFullName: string;
  currentUserRole: "candidate" | "recruiter";
  participantRole: "CANDIDATE" | "HOST" | "INTERVIEWER";
  meetingCode: string;
  /** UUID thật của user đang login (lấy từ BE). */
  userId: string;
};

type ApiParticipant = {
  userId: string;
  fullName: string;
  role: "HOST" | "INTERVIEWER" | "CANDIDATE";
};

type ApiResponse = {
  success: boolean;
  participants?: ApiParticipant[];
  message?: string;
};

const ROLE_LABEL_VI: Record<"HOST" | "INTERVIEWER" | "CANDIDATE", string> = {
  HOST: "Host",
  INTERVIEWER: "Interviewer",
  CANDIDATE: "Candidate",
};

export default function ParticipantsDrawer({
  open,
  onClose,
  userFullName,
  participantRole,
  meetingCode,
  userId,
}: Props) {
  const { useRemoteParticipants, useLocalParticipant } = useCallStateHooks();

  const remoteParticipants = useRemoteParticipants();
  const localParticipant = useLocalParticipant();

  // Danh sách participant từ DB (đáng tin)
  const [apiParticipants, setApiParticipants] = useState<ApiParticipant[]>([]);
  const [apiLoaded, setApiLoaded] = useState(false);

  // Cờ đang mute/cam cho từng remote sessionId
  const [mutingBySession, setMutingBySession] = useState<Record<string, boolean>>({});
  const [togglingCamBySession, setTogglingCamBySession] = useState<
    Record<string, boolean>
  >({});

  // Lưu role theo sessionId (xác định từ GetStream customData)
  // Có thể có 2 recruiter trong phòng — không thể phân biệt chỉ bằng userId
  // nếu user ẩn metadata. Vì vậy map theo `userId` từ customData.
  const [roleByUserId, setRoleByUserId] = useState<
    Record<string, "HOST" | "INTERVIEWER" | "CANDIDATE">
  >({});

  // Fetch participants từ DB khi mở drawer
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setApiLoaded(false);

    fetch(`/api/interviews/${encodeURIComponent(meetingCode)}/participants`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data: ApiResponse) => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.participants)) {
          setApiParticipants(data.participants);
        }
      })
      .catch((err) => {
        console.error("[ParticipantsDrawer] fetch participants error:", err);
      })
      .finally(() => {
        if (!cancelled) setApiLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, meetingCode]);

  // Đọc customData từ GetStream local + remote để biết role + dbUserId
  useEffect(() => {
    const next: Record<string, "HOST" | "INTERVIEWER" | "CANDIDATE"> = {};
    const readFrom = (p: { userId?: string; customData?: unknown } | null) => {
      if (!p?.userId) return;
      const custom = p.customData as
        | { participantRole?: string; dbUserId?: string }
        | undefined;
      if (custom?.participantRole) {
        next[p.userId] = custom.participantRole as
          | "HOST"
          | "INTERVIEWER"
          | "CANDIDATE";
      }
    };
    readFrom(localParticipant as unknown as { userId?: string; customData?: unknown });
    for (const r of remoteParticipants ?? []) {
      readFrom(r as unknown as { userId?: string; customData?: unknown });
    }
    setRoleByUserId(next);
  }, [localParticipant, remoteParticipants]);

  /**
   * Xác định role của 1 remote participant bằng cách kết hợp:
   *  1. customData từ GetStream (nếu join có set)
   *  2. DB participants (map userId → role) — fallback chính
   *  3. Mặc định theo role của current user
   *     - Nếu current user là candidate → remote là INTERVIEWER hoặc HOST
   *     - Nếu current user là recruiter → remote là CANDIDATE
   *  4. Trong phòng 3 người: nếu cả HOST và INTERVIEWER đều là recruiter
   *     thì dùng participant_role từ DB để phân biệt.
   */
  const resolveRole = useCallback(
    (
      remote: RemoteLike,
    ): "HOST" | "INTERVIEWER" | "CANDIDATE" => {
      // 1) Từ customData (nhanh nhất)
      const streamUserId = remote.userId;
      if (streamUserId && roleByUserId[streamUserId]) {
        return roleByUserId[streamUserId];
      }
      // 2) Từ DB: tìm theo userId của remote (UUID thật)
      if (streamUserId) {
        const match = apiParticipants.find((p) => p.userId === streamUserId);
        if (match) return match.role;
      }
      // 3) Fallback theo role của current user
      //    (giữ nguyên hành vi cũ để không vỡ khi metadata chưa sẵn sàng)
      return participantRole === "CANDIDATE" ? "INTERVIEWER" : "CANDIDATE";
    },
    [apiParticipants, participantRole, roleByUserId],
  );

  // Tên hiển thị cho remote
  const resolveName = useCallback(
    (remote: RemoteLike): string => {
      const streamUserId = remote.userId;
      if (streamUserId) {
        const match = apiParticipants.find((p) => p.userId === streamUserId);
        if (match) return match.fullName;
      }
      return remote.name ?? "Guest";
    },
    [apiParticipants],
  );

  // Build danh sách hiển thị
  const participants: Participant[] = useMemo(() => {
    const list: Participant[] = [];

    // 1) Local (mình) — luôn ở đầu
    if (localParticipant) {
      list.push({
        sessionId: localParticipant.sessionId,
        dbUserId: userId,
        name: userFullName,
        roleLabel: participantRole,
        micOn: hasAudio(localParticipant),
        cameraOn: hasVideo(localParticipant),
        isYou: true,
      });
    }

    // 2) Tất cả remote — không cắt về 1 người nữa
    for (const remote of remoteParticipants ?? []) {
      if (!remote.sessionId) continue;
      list.push({
        sessionId: remote.sessionId,
        dbUserId:
          (remote as unknown as { userId?: string }).userId ?? null,
        name: resolveName(remote),
        roleLabel: resolveRole(remote),
        micOn: hasAudio(remote),
        cameraOn: hasVideo(remote),
        isYou: false,
      });
    }

    return list;
  }, [
    localParticipant,
    remoteParticipants,
    userFullName,
    userId,
    participantRole,
    resolveName,
    resolveRole,
  ]);

  // Tổng kết nhanh cho header
  const totalCount = participants.length;
  const interviewerCount = participants.filter(
    (p) => p.roleLabel === "HOST" || p.roleLabel === "INTERVIEWER",
  ).length;
  const candidateCount = participants.filter(
    (p) => p.roleLabel === "CANDIDATE",
  ).length;

  // Tìm remote candidate (cho HOST thao tác mute/cam) — HOST/INTERVIEWER chỉ
  // có quyền điều khiển candidate, không điều khiển lẫn nhau.
  const remoteCandidate = participants.find(
    (p) => !p.isYou && p.roleLabel === "CANDIDATE",
  );

  const isHost = participantRole === "HOST" || participantRole === "INTERVIEWER";

  async function handleToggleMic(sessionId: string, disable: boolean) {
    if (mutingBySession[sessionId]) return;
    setMutingBySession((s) => ({ ...s, [sessionId]: true }));
    try {
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/participant-control`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, action: "mute", disabled: disable }),
        },
      );
      const data = await res.json();
      if (!data.success) console.error("[muteUsers]", data.message);
    } catch (err) {
      console.error("[muteUsers]", err);
    } finally {
      setMutingBySession((s) => ({ ...s, [sessionId]: false }));
    }
  }

  async function handleToggleCamera(sessionId: string, disable: boolean) {
    if (togglingCamBySession[sessionId]) return;
    setTogglingCamBySession((s) => ({ ...s, [sessionId]: true }));
    try {
      const res = await fetch(
        `/api/interviews/${encodeURIComponent(meetingCode)}/participant-control`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, action: "camera", disabled: disable }),
        },
      );
      const data = await res.json();
      if (!data.success) console.error("[disableCamera]", data.message);
    } catch (err) {
      console.error("[disableCamera]", err);
    } finally {
      setTogglingCamBySession((s) => ({ ...s, [sessionId]: false }));
    }
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
            <p className="text-xs text-gray-400">
              {apiLoaded
                ? `${totalCount} người · ${interviewerCount} interviewer · ${candidateCount} candidate`
                : "Đang tải..."}
            </p>
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
          {participants.map((user) => {
            const canControl =
              isHost && !user.isYou && user.roleLabel === "CANDIDATE";
            return (
              <div
                key={user.sessionId}
                className="flex items-center justify-between px-5 py-4
                hover:bg-white/5 transition"
              >
                {/* LEFT */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${
                      user.roleLabel === "HOST"
                        ? "bg-amber-600"
                        : user.roleLabel === "INTERVIEWER"
                        ? "bg-cyan-600"
                        : "bg-violet-600"
                    }`}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm truncate">
                        {user.name}
                      </span>
                      {user.isYou && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 flex-shrink-0">
                          You
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-400">
                        {ROLE_LABEL_VI[user.roleLabel]}
                      </p>
                      <span className="text-xs text-gray-600">•</span>
                      <p className="text-xs text-gray-400">
                        {user.isYou ? "This device" : "Connected"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="flex gap-2 flex-shrink-0 ml-2">
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
                  ) : canControl ? (
                    <>
                      <button
                        onClick={() => handleToggleMic(user.sessionId, user.micOn)}
                        disabled={mutingBySession[user.sessionId]}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                          user.micOn
                            ? "bg-white/10 hover:bg-red-500/30"
                            : "bg-green-500/30 hover:bg-green-500/50"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm text-white">
                          {user.micOn ? "mic" : "mic_off"}
                        </span>
                      </button>
                      <button
                        onClick={() =>
                          handleToggleCamera(user.sessionId, user.cameraOn)
                        }
                        disabled={togglingCamBySession[user.sessionId]}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                          user.cameraOn
                            ? "bg-white/10 hover:bg-red-500/30"
                            : "bg-green-500/30 hover:bg-green-500/50"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm text-white">
                          {user.cameraOn ? "videocam" : "videocam_off"}
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
            );
          })}

          {apiLoaded && totalCount === 0 && (
            <div className="px-5 py-6 text-center text-sm text-gray-500">
              Chưa có ai trong phòng
            </div>
          )}

          {isHost && remoteCandidate && (
            <div className="px-5 py-3">
              <p className="text-[11px] text-gray-500 text-center">
                Host / Interviewer có thể tắt mic / cam của ứng viên
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}