// POST /api/interviews/[meetingCode]/participant-control
//
// Cho phép HOST / INTERVIEWER điều khiển mic/cam của các thành viên khác
// trong phòng. Server gọi GetStream `call.muteUsers(...)` để broadcast
// tới client tương ứng → SDK sẽ tự mute/unmute tracks của user đó.
//
// Body:
//   {
//     action: "mute" | "camera",
//     disabled: boolean,
//     /** GetStream sessionId của participant bị điều khiển (ưu tiên) */
//     sessionId?: string,
//     /** UUID của user bị điều khiển (fallback nếu không có sessionId) */
//     userId?: string,
//   }
//
// Quyền: HOST và INTERVIEWER đều được điều khiển. INTERVIEWER chỉ điều khiển
// CANDIDATE, không điều khiển HOST/interviewer khác.

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

type ParticipantRole = "HOST" | "INTERVIEWER" | "CANDIDATE";

interface ParticipantInfo {
  user_id: string;
  participant_role: "HOST" | "INTERVIEWER" | null;
}

interface CandidateInfo {
  user_id: string | null;
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
    const { sessionId, userId: targetUserId, action, disabled } = body as {
      sessionId?: string;
      userId?: string;
      action?: string;
      disabled?: boolean;
    };

    if (!action || typeof disabled !== "boolean") {
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

    if (!sessionId && !targetUserId) {
      return NextResponse.json(
        {
          success: false,
          message: "Thiếu sessionId hoặc userId của participant cần điều khiển",
        },
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

    // Quyền: HOST hoặc INTERVIEWER của interview này
    const roleRes = await pool.query<{ participant_role: ParticipantRole }>(
      `SELECT participant_role
       FROM interview_participants
       WHERE interview_id = $1 AND user_id = $2
       LIMIT 1`,
      [interview.id, auth.id],
    );
    const myRole = roleRes.rows[0]?.participant_role;
    if (myRole !== "HOST" && myRole !== "INTERVIEWER") {
      return NextResponse.json(
        {
          success: false,
          message: "Chỉ Host hoặc Interviewer mới có quyền này",
        },
        { status: 403 },
      );
    }

    // Xác định target user (UUID thật) và role của họ
    let targetDbUserId: string | null = targetUserId ?? null;
    let targetRole: ParticipantRole | null = null;

    // Lấy sessionId → userId mapping từ Stream (server-side).
    // Nếu đã có userId thì skip bước này.
    if (!targetDbUserId) {
      try {
        const call = serverClient.video.call("default", meetingCode);
        const callState = await call.get();
        const members =
          (callState as unknown as {
            session?: { participants?: Record<string, { user_id?: string }> };
            call?: { session?: { participants?: Record<string, { user_id?: string }> } };
          }).session?.participants ??
          (callState as unknown as {
            call?: { session?: { participants?: Record<string, { user_id?: string }> } };
          }).call?.session?.participants;

        const match = members?.[sessionId as string];
        if (match?.user_id) {
          targetDbUserId = match.user_id;
        }
      } catch (err) {
        console.warn(
          "[participant-control] cannot resolve sessionId → userId:",
          err,
        );
      }
    }

    if (!targetDbUserId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Không xác định được user của participant. Vui lòng thử lại.",
        },
        { status: 400 },
      );
    }

    // Tra role của target trong DB (HOST/INTERVIEWER/CANDIDATE)
    const interviewerRes = await pool.query<ParticipantInfo>(
      `SELECT user_id, participant_role
         FROM interview_participants
        WHERE interview_id = $1 AND user_id = $2
        LIMIT 1`,
      [interview.id, targetDbUserId],
    );
    if (interviewerRes.rows[0]) {
      targetRole = interviewerRes.rows[0].participant_role;
    } else {
      const candRes = await pool.query<CandidateInfo>(
        `SELECT user_id
           FROM interview_candidates
          WHERE interview_id = $1 AND user_id = $2
          LIMIT 1`,
        [interview.id, targetDbUserId],
      );
      if (candRes.rows[0]) {
        targetRole = "CANDIDATE";
      }
    }

    if (!targetRole) {
      return NextResponse.json(
        {
          success: false,
          message: "Không tìm thấy participant trong phòng này",
        },
        { status: 404 },
      );
    }

    // Phân quyền chi tiết:
    //   - INTERVIEWER chỉ điều khiển CANDIDATE, không điều khiển HOST/interviewer khác.
    //   - HOST điều khiển tất cả.
    //   - Không ai được tự điều khiển chính mình (bảo vệ chống click nhầm).
    if (targetDbUserId === auth.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Bạn không thể tắt mic/cam của chính mình ở đây",
        },
        { status: 400 },
      );
    }

    if (myRole === "INTERVIEWER" && targetRole !== "CANDIDATE") {
      return NextResponse.json(
        {
          success: false,
          message: "Interviewer chỉ được điều khiển candidate",
        },
        { status: 403 },
      );
    }

    // Gọi GetStream server-side muteUsers.
    // Lưu ý: `user_ids` ở đây là Stream userId (= UUID thật từ prop `userId`
    // trong InterviewRoomClient, xem customData.dbUserId).
    const call = serverClient.video.call("default", meetingCode);

    await call.muteUsers({
      muted_by_id: auth.id,
      user_ids: [targetDbUserId],
      audio: action === "mute" ? disabled : undefined,
      video: action === "camera" ? disabled : undefined,
    });

    return NextResponse.json({
      success: true,
      action,
      disabled,
      targetUserId: targetDbUserId,
      targetRole,
    });
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