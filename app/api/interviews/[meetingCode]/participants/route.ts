// GET /api/interviews/[meetingCode]/participants
//
// Trả về danh sách TẤT CẢ participants của 1 interview, kèm:
//   - id (user uuid)            → dùng để map với GetStream userId
//   - fullName
//   - role                      → HOST | INTERVIEWER | CANDIDATE
//
// Đây là nguồn dữ liệu đáng tin duy nhất cho ParticipantsDrawer —
// vì GetStream chỉ trả về tên hiển thị, không trả về role thật
// của user trong DB. Trong 1 phòng có tối đa 3 người:
//   1 host (recruiter) + 1 interviewer (recruiter) + 1 candidate.
//
// Chỉ participant của interview mới được phép đọc danh sách này.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ meetingCode: string }>;
}

interface InterviewRow {
  id: string;
}

interface InterviewerRow {
  user_id: string;
  full_name: string;
  participant_role: "HOST" | "INTERVIEWER";
}

interface CandidateRow {
  user_id: string | null;
  candidate_name: string | null;
  full_name: string | null;
}

async function findInterview(meetingCode: string): Promise<InterviewRow | null> {
  const res = await pool.query<InterviewRow>(
    `SELECT id FROM interviews
     WHERE meeting_code = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [meetingCode],
  );
  return res.rows[0] ?? null;
}

export async function GET(_req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(_req);
    if (!auth) return unauthorized();

    const { meetingCode } = await ctx.params;
    const interview = await findInterview(meetingCode);
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    // Verify người gọi là participant của phòng này (HOST/INTERVIEWER/CANDIDATE)
    let isParticipant = false;
    if (auth.role === "RECRUITER" || auth.role === "ADMIN") {
      const r = await pool.query(
        `SELECT 1 FROM interview_participants
         WHERE interview_id = $1 AND user_id = $2 LIMIT 1`,
        [interview.id, auth.id],
      );
      isParticipant = r.rows.length > 0;
    } else if (auth.role === "CANDIDATE") {
      const r = await pool.query(
        `SELECT 1 FROM interview_candidates
         WHERE interview_id = $1 AND user_id = $2 LIMIT 1`,
        [interview.id, auth.id],
      );
      isParticipant = r.rows.length > 0;
    }

    if (!isParticipant) {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập" },
        { status: 403 },
      );
    }

    // 1) HOST + INTERVIEWER (recruiter-side)
    const interviewers = await pool.query<InterviewerRow>(
      `SELECT ip.user_id, u.full_name, ip.participant_role
         FROM interview_participants ip
         JOIN users u ON u.id = ip.user_id
        WHERE ip.interview_id = $1
          AND ip.participant_role IN ('HOST', 'INTERVIEWER')
        ORDER BY
          CASE WHEN ip.participant_role = 'HOST' THEN 0 ELSE 1 END,
          u.full_name`,
      [interview.id],
    );

    // 2) CANDIDATE — có thể có candidate_name (manual) hoặc full_name (từ users)
    const candidateRes = await pool.query<CandidateRow>(
      `SELECT ic.user_id, ic.candidate_name, u.full_name
         FROM interview_candidates ic
         LEFT JOIN users u ON u.id = ic.user_id
        WHERE ic.interview_id = $1
        LIMIT 1`,
      [interview.id],
    );

    type ApiParticipant = {
      userId: string;
      fullName: string;
      role: "HOST" | "INTERVIEWER" | "CANDIDATE";
    };

    const participants: ApiParticipant[] = [];

    for (const row of interviewers.rows) {
      participants.push({
        userId: row.user_id,
        fullName: row.full_name,
        role: row.participant_role,
      });
    }

    const cand = candidateRes.rows[0];
    if (cand?.user_id) {
      // Ưu tiên candidate_name (do recruiter nhập) > full_name (từ users)
      const name = cand.candidate_name || cand.full_name || "Candidate";
      participants.push({
        userId: cand.user_id,
        fullName: name,
        role: "CANDIDATE",
      });
    }

    return NextResponse.json({
      success: true,
      participants,
    });
  } catch (error) {
    console.error("GET /api/interviews/[meetingCode]/participants ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}