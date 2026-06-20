// GET /api/interviews/[meetingCode]/status
// Trả về thông tin realtime cho Waiting Room:
// - hostJoined: true nếu có row participant_role='HOST' với joined_at IS NOT NULL
// - hostLeft:   true nếu joined_at có nhưng left_at cũng có
//
// Endpoint public cho participants đã xác thực (cookie token).
// Không tiết lộ hash / password.

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

interface HostRow {
  joined_at: Date | null;
  left_at: Date | null;
}

export async function GET(req: Request, ctx: Params) {
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

    const hostRes = await pool.query<HostRow>(
      `SELECT joined_at, left_at
       FROM interview_participants
       WHERE interview_id = $1 AND participant_role = 'HOST'
       LIMIT 1`,
      [interview.id],
    );
    const host = hostRes.rows[0] ?? null;

    const hostJoined =
      host !== null &&
      host.joined_at !== null &&
      (host.left_at === null || host.left_at < host.joined_at);

    return NextResponse.json({
      success: true,
      hostJoined,
      hostPresent: hostJoined,
    });
  } catch (error) {
    console.error("GET /status ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}