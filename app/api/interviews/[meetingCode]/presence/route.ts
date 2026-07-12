// /api/interviews/[meetingCode]/presence
//
// Quản lý "ai đang trong phòng" qua bảng `room_presence`.
//
// Background:
//   interview_candidates chỉ lưu user_id cứng (1 row per interview) →
//   candidate A out thì row.user_id vẫn = A → candidate B vào bị chặn.
//   Bảng room_presence track realtime: heartbeat mỗi ~20s update
//   last_seen_at. Khi user out / crash → row coi như "stale" khi
//   last_seen_at < NOW() - 45s (gấp ~2x heartbeat interval).
//
// Endpoints:
//   POST   /api/interviews/:meetingCode/presence          (join + first heartbeat)
//                       body: { sessionId }
//                       hoặc { sessionId, action: "leave" } (xoá row)
//   PATCH  /api/interviews/:meetingCode/presence          (heartbeat)
//                       body: { sessionId }
//   GET    /api/interviews/:meetingCode/presence          (list active presences)
//                       query: ?role=candidate|host|interviewer (optional)
//   DELETE /api/interviews/:meetingCode/presence          (legacy; dùng POST leave)
//
// Auth: chỉ participant của interview mới được phép.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ meetingCode: string }>;
}

interface InterviewRow {
  id: string;
}

interface ParticipantRow {
  participant_role: "HOST" | "INTERVIEWER";
}

interface CandidateRow {
  user_id: string | null;
}

interface PresenceRow {
  user_id: string;
  participant_role: "HOST" | "INTERVIEWER" | "CANDIDATE";
  session_id: string;
  joined_at: Date | string;
  last_seen_at: Date | string;
}

/**
 * Resolve participant_role của user trong interview. Trả null nếu user
 * không phải participant (kể cả trong trường hợp attachCandidate fail).
 */
async function resolveParticipantRole(
  interviewId: string,
  userId: string,
  userRole: "CANDIDATE" | "RECRUITER" | "ADMIN",
): Promise<"HOST" | "INTERVIEWER" | "CANDIDATE" | null> {
  if (userRole === "RECRUITER" || userRole === "ADMIN") {
    const res = await pool.query<ParticipantRow>(
      `SELECT participant_role
       FROM interview_participants
       WHERE interview_id = $1 AND user_id = $2
       LIMIT 1`,
      [interviewId, userId],
    );
    return res.rows[0]?.participant_role ?? null;
  }
  // CANDIDATE
  const res = await pool.query<CandidateRow>(
    `SELECT user_id
     FROM interview_candidates
     WHERE interview_id = $1
     LIMIT 1`,
    [interviewId],
  );
  if (res.rows[0]?.user_id === userId) return "CANDIDATE";
  return null;
}

async function getInterviewByMeetingCode(
  meetingCode: string,
): Promise<InterviewRow | null> {
  const res = await pool.query<InterviewRow>(
    `SELECT id FROM interviews
     WHERE meeting_code = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [meetingCode],
  );
  return res.rows[0] ?? null;
}

/**
 * POST — Join room (insert row presence) + first heartbeat.
 *
 * Body: { sessionId: string, action?: "leave" }
 *
 * - Không có action: insert/refresh row presence.
 * - action === "leave": xoá row (dùng cho sendBeacon khi tab đóng vì
 *   sendBeacon chỉ hỗ trợ POST).
 *
 * Idempotent: nếu đã có row (interview_id, user_id, session_id) → UPDATE
 * last_seen_at, không insert duplicate.
 */
export async function POST(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();

    const { meetingCode } = await ctx.params;
    const body = (await req.json().catch(() => null)) as {
      sessionId?: string;
      action?: string;
    } | null;
    const sessionId = body?.sessionId;
    const action = body?.action;

    // action=leave dùng cho sendBeacon khi tab đóng (sendBeacon chỉ hỗ trợ
    // POST, không gọi được DELETE). Không bắt buộc sessionId vẫn an toàn:
    // chỉ xoá row của chính user đó trong interview.
    if (action === "leave") {
      if (!sessionId || typeof sessionId !== "string") {
        return NextResponse.json(
          { success: false, message: "sessionId không hợp lệ" },
          { status: 400 },
        );
      }
      const interview = await getInterviewByMeetingCode(meetingCode);
      if (!interview) {
        // Phòng không tồn tại → idempotent, trả success để client không retry.
        return NextResponse.json({ success: true });
      }
      await pool.query(
        `DELETE FROM room_presence
         WHERE interview_id = $1
           AND user_id = $2
           AND session_id = $3`,
        [interview.id, auth.id, sessionId],
      );
      return NextResponse.json({ success: true });
    }

    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 64) {
      return NextResponse.json(
        { success: false, message: "sessionId không hợp lệ" },
        { status: 400 },
      );
    }

    const interview = await getInterviewByMeetingCode(meetingCode);
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    const role = await resolveParticipantRole(
      interview.id,
      auth.id,
      auth.role,
    );
    if (!role) {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập" },
        { status: 403 },
      );
    }

    await pool.query(
      `INSERT INTO room_presence
         (interview_id, user_id, participant_role, session_id, joined_at, last_seen_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (interview_id, user_id, session_id)
         DO UPDATE SET last_seen_at = NOW()`,
      [interview.id, auth.id, role, sessionId],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /presence ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH — Heartbeat (client gọi mỗi ~20s).
 *
 * Body: { sessionId: string }
 */
export async function PATCH(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();

    const { meetingCode } = await ctx.params;
    const body = (await req.json().catch(() => null)) as {
      sessionId?: string;
    } | null;
    const sessionId = body?.sessionId;
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { success: false, message: "sessionId không hợp lệ" },
        { status: 400 },
      );
    }

    const interview = await getInterviewByMeetingCode(meetingCode);
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    const role = await resolveParticipantRole(
      interview.id,
      auth.id,
      auth.role,
    );
    if (!role) {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập" },
        { status: 403 },
      );
    }

    await pool.query(
      `UPDATE room_presence
       SET last_seen_at = NOW()
       WHERE interview_id = $1
         AND user_id = $2
         AND session_id = $3`,
      [interview.id, auth.id, sessionId],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /presence ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE — Leave room (legacy; không dùng nữa, dùng POST action=leave
 * vì sendBeacon chỉ hỗ trợ POST).
 *
 * Body: { sessionId: string }
 *
 * Nếu user crash/đóng tab không gọi được request nào → row tự stale
 * sau 45s, không cần cleanup thủ công.
 *
 * @deprecated Dùng POST { action: "leave" } thay thế.
 */
export async function DELETE(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();

    const { meetingCode } = await ctx.params;
    const body = (await req.json().catch(() => null)) as {
      sessionId?: string;
    } | null;
    const sessionId = body?.sessionId;
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { success: false, message: "sessionId không hợp lệ" },
        { status: 400 },
      );
    }

    const interview = await getInterviewByMeetingCode(meetingCode);
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    await pool.query(
      `DELETE FROM room_presence
       WHERE interview_id = $1
         AND user_id = $2
         AND session_id = $3`,
      [interview.id, auth.id, sessionId],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /presence ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}

/**
 * GET — List các presence đang ACTIVE.
 *
 * Query: ?role=candidate|host|interviewer (optional)
 *
 * "Active" = last_seen_at > NOW() - 45s.
 */
export async function GET(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();

    const { meetingCode } = await ctx.params;
    const interview = await getInterviewByMeetingCode(meetingCode);
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    const role = await resolveParticipantRole(
      interview.id,
      auth.id,
      auth.role,
    );
    if (!role) {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập" },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const roleFilter = url.searchParams.get("role");

    const params: unknown[] = [interview.id];
    let whereExtra = "";
    if (
      roleFilter &&
      ["HOST", "INTERVIEWER", "CANDIDATE"].includes(roleFilter.toUpperCase())
    ) {
      params.push(roleFilter.toUpperCase());
      whereExtra = `AND participant_role = $${params.length}`;
    }

    const res = await pool.query<PresenceRow>(
      `SELECT user_id, participant_role, session_id, joined_at, last_seen_at
       FROM room_presence
       WHERE interview_id = $1
         AND last_seen_at > NOW() - INTERVAL '45 seconds'
         ${whereExtra}
       ORDER BY joined_at ASC`,
      params,
    );

    return NextResponse.json({
      success: true,
      active: res.rows.map((r) => ({
        userId: r.user_id,
        participantRole: r.participant_role,
        sessionId: r.session_id,
        joinedAt:
          r.joined_at instanceof Date
            ? r.joined_at.toISOString()
            : r.joined_at,
        lastSeenAt:
          r.last_seen_at instanceof Date
            ? r.last_seen_at.toISOString()
            : r.last_seen_at,
      })),
    });
  } catch (error) {
    console.error("GET /presence ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}