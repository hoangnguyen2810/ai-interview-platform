import { NextResponse } from "next/server";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = getAuthUserFromRequest(req);
  if (!auth) return unauthorized();
  if (auth.role !== "RECRUITER") {
    return NextResponse.json(
      { error: "Chỉ recruiter mới xem được danh sách này" },
      { status: 403 },
    );
  }

  try {
    const result = await pool.query(
      `
      SELECT
        i.id,
        i.title,
        i.meeting_code,
        i.scheduled_at,
        i.max_interviewers,
        u.avatar_url
      FROM interviews i
      JOIN interview_participants ip ON ip.interview_id = i.id
      JOIN users u ON u.id = ip.user_id
      WHERE i.deleted_at IS NULL
        AND ip.user_id  = $1
        AND ip.participant_role = 'HOST'
        AND (i.scheduled_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
            = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      ORDER BY i.scheduled_at ASC
      LIMIT 2
      `,
      [auth.id],
    );

    const now = Date.now();

    const interviews = result.rows.map((row) => {
      const scheduledDate = new Date(row.scheduled_at);
      const isStarted = scheduledDate.getTime() <= now;

      return {
        id: row.id,
        title: row.title,
        meetingCode: row.meeting_code,
        scheduledAt: row.scheduled_at,
        scheduledTime: scheduledDate.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        maxInterviewers: String(row.max_interviewers),
        status: isStarted ? "ONGOING" : "SCHEDULED",
        avatar: row.avatar_url || "https://i.pravatar.cc/150",
      };
    });

    return NextResponse.json(interviews);
  } catch (err) {
    console.error("GET /interviews/upcoming error:", err);

    return NextResponse.json(
      { error: "Failed to fetch interviews" },
      { status: 500 },
    );
  }
}
