// POST /api/interviews/[meetingCode]/verify-password
//
// Xác thực password phòng cho INTERVIEWER / CANDIDATE.
// - HOST: tự bypass (không gọi endpoint này)
// - Verify bằng bcrypt.compare với room_password_hash trong DB
// - Nếu đúng → set cookie gate cho interview (8h)
// - Nếu sai → 401 (không redirect)

import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/auth";
import { setPasswordGateCookie, gateCookieName } from "@/lib/interview-password-gate";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ meetingCode: string }>;
}

interface InterviewRow {
  id: string;
  room_password_hash: string | null;
}

interface ParticipantRow {
  participant_role: "HOST" | "INTERVIEWER";
}

interface CandidateRow {
  user_id: string | null;
}

async function findInterview(
  meetingCode: string,
): Promise<InterviewRow | null> {
  const res = await pool.query<InterviewRow>(
    `SELECT id, room_password_hash
     FROM interviews
     WHERE meeting_code = $1
     LIMIT 1`,
    [meetingCode],
  );
  return res.rows[0] ?? null;
}

async function findParticipantRole(
  interviewId: string,
  userId: string,
): Promise<"HOST" | "INTERVIEWER" | null> {
  const res = await pool.query<ParticipantRow>(
    `SELECT participant_role
     FROM interview_participants
     WHERE interview_id = $1 AND user_id = $2
     LIMIT 1`,
    [interviewId, userId],
  );
  return res.rows[0]?.participant_role ?? null;
}

async function findCandidate(
  interviewId: string,
  userId: string,
): Promise<boolean> {
  const res = await pool.query<CandidateRow>(
    `SELECT user_id
     FROM interview_candidates
     WHERE interview_id = $1 AND user_id = $2
     LIMIT 1`,
    [interviewId, userId],
  );
  return res.rows.length > 0;
}

export async function POST(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập" },
        { status: 401 },
      );
    }

    const { meetingCode } = await ctx.params;
    const interview = await findInterview(meetingCode);
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng phỏng vấn không tồn tại" },
        { status: 404 },
      );
    }

    // Xác định participant_role để quyết định có cần verify không
    let role: "HOST" | "INTERVIEWER" | "CANDIDATE" | null = null;

    if (auth.role === "RECRUITER" || auth.role === "ADMIN") {
      const pr = await findParticipantRole(interview.id, auth.id);
      if (pr === "HOST") {
        // HOST bypass password — không cần verify
        const response = NextResponse.json({
          success: true,
          message: "HOST bypass",
        });
        return response;
      }
      if (pr === "INTERVIEWER") role = "INTERVIEWER";
    } else if (auth.role === "CANDIDATE") {
      const isCandidate = await findCandidate(interview.id, auth.id);
      if (isCandidate) role = "CANDIDATE";
    }

    if (!role) {
      return NextResponse.json(
        { success: false, message: "Bạn không thuộc phòng phỏng vấn này" },
        { status: 403 },
      );
    }

    // Interview không có password → không cần verify (gate luôn pass)
    if (!interview.room_password_hash) {
      const response = NextResponse.json({
        success: true,
        message: "Phòng không có mật khẩu",
      });
      setPasswordGateCookie(response, interview.id);
      return response;
    }

    // Đọc password từ body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Body phải là JSON hợp lệ" },
        { status: 400 },
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as Record<string, unknown>).password !== "string"
    ) {
      return NextResponse.json(
        { success: false, message: "Thiếu mật khẩu" },
        { status: 400 },
      );
    }

    const password = (body as { password: string }).password;
    if (password.length === 0) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu không được để trống" },
        { status: 400 },
      );
    }

    const ok = await bcrypt.compare(password, interview.room_password_hash);
    if (!ok) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu phòng không đúng" },
        { status: 401 },
      );
    }

    // Verify thành công → set cookie gate
    const response = NextResponse.json({
      success: true,
      message: "Xác thực thành công",
    });
    setPasswordGateCookie(response, interview.id);
    // DEBUG: log các Set-Cookie header trên response thực tế
    console.log("[verify-password] Set-Cookie headers:", {
      interviewId: interview.id,
      cookieName: gateCookieName(interview.id),
      setCookieCount: response.headers.getSetCookie?.() ?? null,
      allSetCookie: response.headers.get("set-cookie"),
    });
    return response;
  } catch (error) {
    console.error("POST /verify-password ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}