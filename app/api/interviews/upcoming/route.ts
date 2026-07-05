// GET /api/interviews/upcoming
//
// Trả về các buổi phỏng vấn của recruiter trong NGÀY HÔM NAY (timezone VN).
// Bao gồm cả 3 status: SCHEDULED, ONGOING, FINISHED — để client (UpcomingInterviews
// vs RecentInterviews) tự filter theo nhu cầu.
//
// Lý do đổi: trước đây API chỉ trả SCHEDULED/ONGOING → RecentInterviews phải dùng
// data hardcoded. Giờ cho phép 1 endpoint duy nhất cung cấp cả 2 view.

import { NextResponse } from "next/server";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

type InterviewStatus = "SCHEDULED" | "ONGOING" | "FINISHED";

interface Row {
  id: string;
  title: string;
  description: string | null;
  meeting_code: string;
  room_password_hash: string | null;
  scheduled_at: Date | string;
  ended_at: Date | string | null;
  started_at: Date | string | null;
  max_interviewers: number;
  max_participants: number;
  duration_minutes: number;
  status: InterviewStatus;
  allow_guest: boolean;
  enable_recording: boolean;
  avatar_url: string | null;
}

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
    // Lấy tất cả buổi của host trong NGÀY HÔM NAY (timezone VN).
    // status DB có thể là SCHEDULED/ONGOING/FINISHED/CANCELLED.
    // Ta sẽ suy ra trạng thái hiển thị ở client:
    //   - scheduled_at > now         → SCHEDULED
    //   - scheduled_at <= now, chưa FINISHED → ONGOING
    //   - status = 'FINISHED'        → FINISHED
    //   - CANCELLED                  → bỏ qua (không trả về)
    const result = await pool.query<Row>(
      `
      SELECT
        i.id,
        i.title,
        i.description,
        i.meeting_code,
        i.room_password_hash,
        i.scheduled_at,
        i.started_at,
        i.ended_at,
        i.max_interviewers,
        i.max_participants,
        i.duration_minutes,
        i.status,
        i.allow_guest,
        i.enable_recording,
        u.avatar_url
      FROM interviews i
      JOIN interview_participants ip ON ip.interview_id = i.id
      JOIN users u ON u.id = ip.user_id
      WHERE i.deleted_at IS NULL
        AND ip.user_id = $1
        AND ip.participant_role = 'HOST'
        AND i.status <> 'CANCELLED'
        AND (i.scheduled_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
            = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      ORDER BY
        -- FINISHED xuống cuối để view "Upcoming" tự nhiên hơn,
        -- Recent component sẽ filter riêng.
        CASE WHEN i.status = 'FINISHED' THEN 1 ELSE 0 END,
        i.scheduled_at ASC
      LIMIT 50
      `,
      [auth.id],
    );

    const now = Date.now();

    const interviews = result.rows.map((row) => {
      const scheduledDate = new Date(row.scheduled_at);

      // Suy ra trạng thái hiển thị từ DB status + scheduled_at
      let displayStatus: InterviewStatus;
      if (row.status === "FINISHED") {
        displayStatus = "FINISHED";
      } else if (scheduledDate.getTime() <= now) {
        displayStatus = "ONGOING";
      } else {
        displayStatus = "SCHEDULED";
      }

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        meetingCode: row.meeting_code,
        scheduledAt:
          row.scheduled_at instanceof Date
            ? row.scheduled_at.toISOString()
            : row.scheduled_at,
        endedAt:
          row.ended_at instanceof Date
            ? row.ended_at.toISOString()
            : row.ended_at,
        startedAt:
          row.started_at instanceof Date
            ? row.started_at.toISOString()
            : row.started_at,
        scheduledTime: scheduledDate.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        maxInterviewers: String(row.max_interviewers),
        maxParticipants: row.max_participants,
        durationMinutes: row.duration_minutes,
        allowGuest: row.allow_guest,
        enableRecording: row.enable_recording,
        status: displayStatus,
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