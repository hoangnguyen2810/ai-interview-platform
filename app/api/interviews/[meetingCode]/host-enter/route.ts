// POST /api/interviews/[meetingCode]/host-enter
// Đánh dấu HOST đã vào meeting room: UPDATE joined_at = NOW() cho row HOST.
//
// Idempotent: nếu đã có joined_at (và left_at NULL hoặc < joined_at) thì không ghi đè.
// Khi HOST quay lại sau khi rời: clear left_at, cập nhật joined_at = NOW().

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ meetingCode: string }>;
}

interface InterviewRow {
  id: string;
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

    const interviewRes = await pool.query<InterviewRow>(
      `SELECT id FROM interviews WHERE meeting_code = $1 LIMIT 1`,
      [meetingCode],
    );
    const interview = interviewRes.rows[0];
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    // Verify user hiện tại là HOST của interview này
    const roleRes = await pool.query<{ participant_role: string }>(
      `SELECT participant_role
       FROM interview_participants
       WHERE interview_id = $1 AND user_id = $2
       LIMIT 1`,
      [interview.id, auth.id],
    );
    const role = roleRes.rows[0]?.participant_role;
    if (role !== "HOST") {
      return NextResponse.json(
        { success: false, message: "Chỉ Host mới có quyền này" },
        { status: 403 },
      );
    }

    // Mark joined_at, clear left_at
    await pool.query(
      `UPDATE interview_participants
       SET joined_at = NOW(), left_at = NULL
       WHERE interview_id = $1 AND user_id = $2`,
      [interview.id, auth.id],
    );

    return NextResponse.json({
      success: true,
      message: "Đã đánh dấu Host vào phòng",
    });
  } catch (error) {
    console.error("POST /host-enter ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}