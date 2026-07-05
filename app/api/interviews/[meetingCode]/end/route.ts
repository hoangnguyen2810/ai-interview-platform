// POST /api/interviews/[meetingCode]/end
//
// Endpoint dùng khi HOST (recruiter) bấm End Call để kết thúc buổi phỏng vấn.
// Quyền: chỉ HOST/CO_HOST mới được end toàn bộ phòng.
// CANDIDATE không gọi endpoint này — họ chỉ rời phòng (call.leave()).
//
// Hành động:
//   1. Set interviews.status = 'FINISHED' và ended_at = NOW()
//   2. Update interview_participants: left_at = NOW() cho tất cả participants
//   3. End call trên GetStream (call.end()) → kick toàn bộ clients khác
//
// Lưu ý:
//   - Endpoint KHÔNG stop recording. Client nên stop recording TRƯỚC khi gọi
//     endpoint này (xem FooterControls endCall logic).
//   - Endpoint dùng `@stream-io/node-sdk` để gọi `call.end()`.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth";
import { StreamClient } from "@stream-io/node-sdk";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ meetingCode: string }>;
}

interface InterviewRow {
  id: string;
  status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";
}

interface HostRow {
  participant_role: "HOST" | "CO_HOST";
}

function getStreamServer() {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const secret = process.env.STREAM_API_SECRET;
  if (!apiKey || !secret) {
    throw new Error("Stream credentials chưa được cấu hình");
  }
  return new StreamClient(apiKey, secret);
}

export async function POST(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();

    const { meetingCode } = await ctx.params;

    // Tìm interview
    const interviewRes = await pool.query<InterviewRow>(
      `SELECT id, status FROM interviews
       WHERE meeting_code = $1 AND deleted_at IS NULL
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

    // Chỉ HOST/CO_HOST được end toàn bộ phòng
    if (auth.role === "RECRUITER" || auth.role === "ADMIN") {
      const hostRes = await pool.query<HostRow>(
        `SELECT participant_role
         FROM interview_participants
         WHERE interview_id = $1 AND user_id = $2
         LIMIT 1`,
        [interview.id, auth.id],
      );
      const role = hostRes.rows[0]?.participant_role;
      if (role !== "HOST" && role !== "CO_HOST") {
        return NextResponse.json(
          { success: false, message: "Chỉ HOST mới có quyền kết thúc phòng" },
          { status: 403 },
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "Candidate không có quyền kết thúc toàn bộ phòng",
        },
        { status: 403 },
      );
    }

    // 1. Update interviews.status → FINISHED + ended_at
    //    Lưu ý: bảng `interviews` KHÔNG có cột `updated_at` (xem db/schema.sql),
    //    chỉ có `created_at` và `deleted_at`. Đừng thêm updated_at ở đây.
    await pool.query(
      `UPDATE interviews
       SET status = 'FINISHED',
           ended_at = NOW()
       WHERE id = $1`,
      [interview.id],
    );

    // 2. Cập nhật left_at cho mọi participant còn trong phòng
    await pool.query(
      `UPDATE interview_participants
       SET left_at = NOW()
       WHERE interview_id = $1
         AND joined_at IS NOT NULL
         AND (left_at IS NULL OR left_at < joined_at)`,
      [interview.id],
    );

    // 3. End call trên GetStream (server-side) để kick mọi client còn lại.
    //    Bỏ qua lỗi nếu call đã kết thúc trước đó.
    let streamEnded = false;
    try {
      const stream = getStreamServer();
      const call = stream.video.call("default", meetingCode);
      await call.end();
      streamEnded = true;
    } catch (err) {
      console.warn(
        `[end-interview] call.end() failed for ${meetingCode}:`,
        err instanceof Error ? err.message : err,
      );
      // Không fail cả request nếu Stream end fail — DB đã cập nhật xong.
    }

    return NextResponse.json({
      success: true,
      status: "FINISHED",
      streamEnded,
      message: "Đã kết thúc buổi phỏng vấn",
    });
  } catch (error) {
    console.error("POST /api/interviews/[meetingCode]/end ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}