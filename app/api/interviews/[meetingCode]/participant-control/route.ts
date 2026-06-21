import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/auth";
import { StreamClient } from "@stream-io/node-sdk";

const serverClient = new StreamClient(
  process.env.NEXT_PUBLIC_STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!,
);

interface Params {
  params: Promise<{ meetingCode: string }>;
}

interface InterviewRow {
  id: string;
  meeting_code: string;
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
    const body = await req.json();
    const { userId, action, disabled } = body;

    if (!userId || !action || typeof disabled !== "boolean") {
      return NextResponse.json(
        { success: false, message: "Thiếu tham số hợp lệ" },
        { status: 400 },
      );
    }

    if (action !== "mute" && action !== "camera") {
      return NextResponse.json(
        { success: false, message: "action phải là 'mute' hoặc 'camera'" },
        { status: 400 },
      );
    }

    const interviewRes = await pool.query<InterviewRow>(
      `SELECT id, meeting_code FROM interviews WHERE meeting_code = $1 LIMIT 1`,
      [meetingCode],
    );
    const interview = interviewRes.rows[0];
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    const roleRes = await pool.query<{ participant_role: string }>(
      `SELECT participant_role
       FROM interview_participants
       WHERE interview_id = $1 AND user_id = $2
       LIMIT 1`,
      [interview.id, auth.id],
    );
    const role = roleRes.rows[0]?.participant_role;
    if (role !== "HOST" && role !== "CO_HOST") {
      return NextResponse.json(
        { success: false, message: "Chỉ Host mới có quyền này" },
        { status: 403 },
      );
    }

    // ✅ Dùng client.video.call() theo docs mới nhất
    const call = serverClient.video.call("default", meetingCode);

    await call.muteUsers({
      muted_by_id: "system",
      user_ids: [userId],
      audio: action === "mute" ? disabled : undefined,
      video: action === "camera" ? disabled : undefined,
    });

    return NextResponse.json({ success: true, action, disabled });
  } catch (error) {
    console.error("POST /participant-control ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}
