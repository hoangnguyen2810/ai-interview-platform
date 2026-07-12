// Server-side helpers dùng cho routing /interview/* và /join/*
//
// - Xác thực user từ cookie JWT
// - Xác thực user có quyền truy cập interview:
//   + Recruiter/Admin: nằm trong interview_participants (HOST hoặc INTERVIEWER).
//     Nếu CHƯA có → tự INSERT với INTERVIEWER (auto-attach qua meetingCode).
//   + Candidate: có row trong interview_candidates (auto-create khi /join).
//
// - Password gate:
//   + HOST: bypass hoàn toàn.
//   + INTERVIEWER / CANDIDATE: nếu interview có room_password_hash → phải có
//     cookie gate `interview_pwd_<interviewId>=1` mới được vào Waiting/Room.
//     Nếu chưa có gate → trả về `passwordRequired: true` (page render form).
//   + Interview không có password → bypass gate.
//
// - KHÔNG redirect khi thiếu password (UI tự render form). Chỉ redirect
//   /login khi chưa auth hoặc interview không tồn tại hoặc không phải participant.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import { pool } from "@/lib/db";
import { isPasswordGatePassed } from "@/lib/interview-password-gate";

export type InterviewRole = "HOST" | "INTERVIEWER" | "CANDIDATE";

export interface AuthedUser {
  id: string;
  role: "CANDIDATE" | "RECRUITER" | "ADMIN";
}

export interface InterviewAccess {
  user: AuthedUser;
  interviewId: string;
  meetingCode: string;
  title: string;
  status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";
  scheduledAt: string;
  participantRole: InterviewRole;
  /** Bằng true khi interview có password và user chưa verify */
  passwordRequired: boolean;
  /** Tên thật của user hiện tại */
  userFullName: string;
  /** Tên thật của participant còn lại */
  otherParticipantName: string | null;
}

export async function getAuthedUser(): Promise<AuthedUser | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get("token");
  const token = tokenCookie?.value;
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload & {
      id: string;
      role: AuthedUser["role"];
    };
    if (!decoded.id || !decoded.role) return null;
    return { id: String(decoded.id), role: decoded.role };
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<AuthedUser> {
  const user = await getAuthedUser();
  if (!user) redirect("/login");
  return user;
}

interface InterviewRow {
  id: string;
  meeting_code: string;
  title: string;
  status: InterviewAccess["status"];
  scheduled_at: string;
  allow_guest: boolean;
  room_password_hash: string | null;
}

interface ParticipantRow {
  participant_role: "HOST" | "INTERVIEWER";
}

interface CandidateRow {
  id: string;
  user_id: string | null;
}

export async function findInterviewByMeetingCode(
  meetingCode: string,
): Promise<InterviewRow | null> {
  const res = await pool.query<InterviewRow>(
    `SELECT id, meeting_code, title, status, scheduled_at, allow_guest, room_password_hash
     FROM interviews
     WHERE meeting_code = $1
     LIMIT 1`,
    [meetingCode],
  );
  return res.rows[0] ?? null;
}

export async function findParticipantRole(
  interviewId: string,
  userId: string,
): Promise<InterviewRole | null> {
  const res = await pool.query<ParticipantRow>(
    `SELECT participant_role
     FROM interview_participants
     WHERE interview_id = $1 AND user_id = $2
     LIMIT 1`,
    [interviewId, userId],
  );
  const row = res.rows[0];
  return row?.participant_role ?? null;
}

/**
 * Tự động attach recruiter vào interview nếu chưa có.
 * - Đã có row → trả về role hiện tại
 * - Chưa có → INSERT với INTERVIEWER (ON CONFLICT DO NOTHING)
 */
async function attachRecruiter(
  interviewId: string,
  userId: string,
): Promise<InterviewRole> {
  const existing = await findParticipantRole(interviewId, userId);
  if (existing) return existing;

  await pool.query(
    `INSERT INTO interview_participants (interview_id, user_id, participant_role)
     VALUES ($1, $2, 'INTERVIEWER')
     ON CONFLICT (interview_id, user_id) DO NOTHING`,
    [interviewId, userId],
  );

  return "INTERVIEWER";
}

export async function findCandidateRow(
  interviewId: string,
): Promise<CandidateRow | null> {
  const res = await pool.query<CandidateRow>(
    `SELECT id, user_id
     FROM interview_candidates
     WHERE interview_id = $1
     LIMIT 1`,
    [interviewId],
  );
  return res.rows[0] ?? null;
}

async function attachCandidate(
  interviewId: string,
  userId: string,
): Promise<boolean> {
  const existing = await findCandidateRow(interviewId);

  // CASE 1: row đã gán cho đúng user này → cho phép, refresh joined_at
  // VÀ mở 1 log row mới (append-only) cho mỗi lượt join, kể cả khi
  // đã join trước đó rồi ra rồi vào lại.
  if (existing && existing.user_id === userId) {
    await pool.query(
      `UPDATE interview_candidates
       SET joined_at = NOW()
       WHERE id = $1`,
      [existing.id],
    );
    // Đóng row log cũ (nếu còn open) rồi mở row mới — đảm bảo mỗi lượt
    // join là 1 row mới có joined_at chính xác, không cộng dồn.
    await pool.query(
      `UPDATE interview_participation_log
       SET left_at = NOW(), end_reason = 'LEFT_NORMAL'
       WHERE interview_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [interviewId, userId],
    );
    await pool.query(
      `INSERT INTO interview_participation_log
         (interview_id, user_id, candidate_name, joined_at)
       SELECT $1, $2, candidate_name, NOW()
       FROM interview_candidates WHERE id = $3`,
      [interviewId, userId, existing.id],
    );
    return true;
  }

  // CASE 2: row còn trống (user_id NULL) → claim slot.
  if (existing && existing.user_id === null) {
    await pool.query(
      `UPDATE interview_candidates
       SET user_id = $1, joined_at = NOW()
       WHERE id = $2`,
      [userId, existing.id],
    );
    await pool.query(
      `INSERT INTO interview_participation_log
         (interview_id, user_id, candidate_name, joined_at)
       SELECT $1, $2, candidate_name, NOW()
       FROM interview_candidates WHERE id = $3`,
      [interviewId, userId, existing.id],
    );
    return true;
  }

  // CASE 3: row.user_id trỏ sang candidate khác → check presence.
  //
  // Bug đã sửa: trước đây return false vĩnh viễn khi candidate khác
  // đã gán vào row. Giờ check bảng `room_presence`: nếu KHÔNG còn
  // candidate ACTIVE nào trong phòng (last_seen_at > 45s) → user mới
  // được "thế chỗ", UPDATE row.user_id = userId, joined_at = NOW.
  if (existing && existing.user_id && existing.user_id !== userId) {
    const presenceRes = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM room_presence
         WHERE interview_id = $1
           AND participant_role = 'CANDIDATE'
           AND user_id != $2
           AND last_seen_at > NOW() - INTERVAL '45 seconds'
       ) AS exists`,
      [interviewId, userId],
    );
    const otherCandidateActive = Boolean(presenceRes.rows[0]?.exists);
    if (otherCandidateActive) {
      console.log("[guard] candidate join blocked", {
        reason: "another_candidate_active",
        interviewId,
        currentCandidate: existing.user_id,
        incomingCandidate: userId,
      });
      return false;
    }

    // Slot trống (candidate cũ đã out / stale) → takeover.
    //
    // Log append-only: đóng row open của candidate CŨ (end_reason='TAKEN_OVER')
    // rồi mở row mới cho candidate MỚI. Nhờ vậy dashboard của cả 2
    // candidate đều thấy buổi phỏng vấn đã tham gia.
    const oldUserId = existing.user_id;
    await pool.query(
      `UPDATE interview_participation_log
       SET left_at = NOW(), end_reason = 'TAKEN_OVER'
       WHERE interview_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [interviewId, oldUserId],
    );
    await pool.query(
      `UPDATE interview_candidates
       SET user_id = $1,
           candidate_name = (SELECT full_name FROM users WHERE id = $1),
           candidate_email = (SELECT email FROM users WHERE id = $1),
           joined_at = NOW()
       WHERE id = $2`,
      [userId, existing.id],
    );
    await pool.query(
      `INSERT INTO interview_participation_log
         (interview_id, user_id, candidate_name, joined_at)
       SELECT $1, $2, candidate_name, NOW()
       FROM interview_candidates WHERE id = $3`,
      [interviewId, userId, existing.id],
    );
    // Xoá luôn presence row cũ của candidate cũ trong interview này
    // (defensive — thường đã stale 45s+, nhưng chắc chắn).
    await pool.query(
      `DELETE FROM room_presence
       WHERE interview_id = $1 AND participant_role = 'CANDIDATE'`,
      [interviewId],
    );
    return true;
  }

  // CASE 4: chưa có row nào → INSERT mới.
  const userRes = await pool.query<{ full_name: string; email: string | null }>(
    `SELECT full_name, email FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const userInfo = userRes.rows[0];
  if (!userInfo) return false;

  await pool.query(
    `INSERT INTO interview_candidates (interview_id, user_id, candidate_name, candidate_email, joined_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [interviewId, userId, userInfo.full_name, userInfo.email],
  );
  await pool.query(
    `INSERT INTO interview_participation_log
       (interview_id, user_id, candidate_name, joined_at)
     VALUES ($1, $2, $3, NOW())`,
    [interviewId, userId, userInfo.full_name],
  );
  return true;
}

/**
 * Trả về access info cho interview. KHÔNG redirect khi cần password —
 * trả `passwordRequired: true` để page render form.
 *
 * Redirect chỉ xảy ra khi:
 * - Chưa auth (no cookie)
 * - Interview không tồn tại
 * - User không thuộc participants (sau khi auto-attach cho recruiter vẫn fail)
 */
export async function requireInterviewAccess(
  meetingCode: string,
): Promise<InterviewAccess> {
  const user = await requireAuth();
  const interview = await findInterviewByMeetingCode(meetingCode);
  if (!interview) {
    console.log("[guard] redirect /login", {
      reason: "interview_not_found",
      meetingCode,
      userId: user.id,
      role: user.role,
    });
    redirect("/login");
  }

  let participantRole: InterviewRole | null = null;
  let isParticipant = false;

  if (user.role === "RECRUITER" || user.role === "ADMIN") {
    const existing = await findParticipantRole(interview.id, user.id);
    if (existing) {
      participantRole = existing;
      isParticipant = true;
    } else {
      participantRole = await attachRecruiter(interview.id, user.id);
      isParticipant = true;
    }
  } else if (user.role === "CANDIDATE") {
    const ok = await attachCandidate(interview.id, user.id);
    if (ok) {
      participantRole = "CANDIDATE";
      isParticipant = true;
    }
  }

  if (!participantRole || !isParticipant) {
    console.log("[guard] redirect /login", {
      reason: "not_participant",
      userId: user.id,
      role: user.role,
      meetingCode,
    });
    redirect("/interview/access-denied");
  }

  // Password gate
  const hasPassword = !!interview.room_password_hash;
  const isHost = participantRole === "HOST";
  const gatePassed = await isPasswordGatePassed(interview.id);
  const passwordRequired = hasPassword && !isHost && !gatePassed;

  // Fetch user names
  const userNameRes = await pool.query<{ full_name: string }>(
    `SELECT full_name FROM users WHERE id = $1 LIMIT 1`,
    [user.id],
  );
  const userFullName = userNameRes.rows[0]?.full_name ?? "Unknown";

  let otherParticipantName: string | null = null;
  if (participantRole === "CANDIDATE") {
    const recruiterRes = await pool.query<{ full_name: string }>(
      `SELECT u.full_name
       FROM interview_participants ip
       JOIN users u ON u.id = ip.user_id
       WHERE ip.interview_id = $1 AND ip.participant_role = 'HOST'
       LIMIT 1`,
      [interview.id],
    );
    otherParticipantName = recruiterRes.rows[0]?.full_name ?? "Interviewer";
  } else {
    const candidateRes = await pool.query<{ candidate_name: string }>(
      `SELECT candidate_name FROM interview_candidates
       WHERE interview_id = $1 LIMIT 1`,
      [interview.id],
    );
    otherParticipantName = candidateRes.rows[0]?.candidate_name ?? "Candidate";
  }

  console.log("[guard] access check", {
    userId: user.id,
    role: user.role,
    meetingCode,
    isParticipant,
    participantRole,
    hasPassword,
    isHost,
    gatePassed,
    passwordRequired,
  });

  return {
    user,
    interviewId: interview.id,
    meetingCode: interview.meeting_code,
    title: interview.title,
    status: interview.status,
    scheduledAt: interview.scheduled_at,
    participantRole,
    passwordRequired,
    userFullName,
    otherParticipantName,
  };
}
