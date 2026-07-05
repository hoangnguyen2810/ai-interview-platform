// GET /api/interviews/[meetingCode]/recording-config
//
// Trả về cờ `enableRecording` của interview cho client dùng để quyết định
// có tự động start/stop recording qua GetStream SDK hay không.
//
// Chỉ participant của interview (HOST / INTERVIEWER / CANDIDATE đã attach)
// mới được phép đọc config này.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ meetingCode: string }>;
}

interface InterviewRow {
  id: string;
  enable_recording: boolean;
}

interface ParticipantRow {
  participant_role: "HOST" | "INTERVIEWER";
}

interface CandidateRow {
  user_id: string | null;
}

export async function GET(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();

    const { meetingCode } = await ctx.params;

    const interviewRes = await pool.query<InterviewRow>(
      `SELECT id, enable_recording
       FROM interviews
       WHERE meeting_code = $1
         AND deleted_at IS NULL
       LIMIT 1`,
      [meetingCode],
    );
    const interview = interviewRes.rows[0];
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    // Kiểm tra user hiện tại có phải participant của interview không.
    if (auth.role === "RECRUITER" || auth.role === "ADMIN") {
      const partRes = await pool.query<ParticipantRow>(
        `SELECT participant_role
         FROM interview_participants
         WHERE interview_id = $1 AND user_id = $2
         LIMIT 1`,
        [interview.id, auth.id],
      );
      if (!partRes.rows[0]) {
        return NextResponse.json(
          { success: false, message: "Không có quyền truy cập" },
          { status: 403 },
        );
      }
    } else if (auth.role === "CANDIDATE") {
      const candRes = await pool.query<CandidateRow>(
        `SELECT user_id
         FROM interview_candidates
         WHERE interview_id = $1
         LIMIT 1`,
        [interview.id],
      );
      const cand = candRes.rows[0];
      if (!cand || cand.user_id !== auth.id) {
        return NextResponse.json(
          { success: false, message: "Không có quyền truy cập" },
          { status: 403 },
        );
      }
    } else {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      enableRecording: interview.enable_recording,
    });
  } catch (error) {
    console.error("GET /recording-config ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}