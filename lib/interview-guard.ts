// Server-side helpers dùng cho routing /interview/* và /join/*
// - Xác thực user từ cookie
// - Xác thực user có quyền truy cập interview
//   + Recruiter: là HOST hoặc INTERVIEWER trong interview_participants
//   + Candidate: có row trong interview_candidates (auto-create khi /join)

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import { pool } from "@/lib/db";

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
    `SELECT id, meeting_code, title, status, scheduled_at, allow_guest
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

/**
 * Auto-attach candidate vào interview khi /join:
 * - Nếu chưa có row candidate → insert mới (user_id = current user, name lấy từ users.full_name)
 * - Nếu đã có và user_id = null → gán vào current user
 * - Nếu đã có và user_id = current user → ok
 * - Nếu đã có và user_id khác → không cho join
 */
async function attachCandidate(
  interviewId: string,
  userId: string,
): Promise<boolean> {
  const existing = await findCandidateRow(interviewId);

  if (existing && existing.user_id && existing.user_id !== userId) {
    return false;
  }

  if (existing && existing.user_id === userId) {
    return true;
  }

  if (existing && existing.user_id === null) {
    await pool.query(
      `UPDATE interview_candidates
       SET user_id = $1, joined_at = COALESCE(joined_at, NOW())
       WHERE id = $2`,
      [userId, existing.id],
    );
    return true;
  }

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
  return true;
}

/**
 * Đảm bảo user đã đăng nhập VÀ có quyền truy cập interview.
 * - Không auth → redirect /login
 * - Không tìm thấy interview → redirect /login
 * - Recruiter không phải participant → redirect /login
 * - Candidate không attach được → redirect /login
 */
export async function requireInterviewAccess(
  meetingCode: string,
): Promise<InterviewAccess> {
  const user = await requireAuth();
  const interview = await findInterviewByMeetingCode(meetingCode);
  if (!interview) redirect("/login");

  let participantRole: InterviewRole | null = null;

  if (user.role === "RECRUITER" || user.role === "ADMIN") {
    participantRole = await findParticipantRole(interview.id, user.id);
  } else if (user.role === "CANDIDATE") {
    const ok = await attachCandidate(interview.id, user.id);
    if (ok) participantRole = "CANDIDATE";
  }

  if (!participantRole) redirect("/login");

  return {
    user,
    interviewId: interview.id,
    meetingCode: interview.meeting_code,
    title: interview.title,
    status: interview.status,
    scheduledAt: interview.scheduled_at,
    participantRole,
  };
}
