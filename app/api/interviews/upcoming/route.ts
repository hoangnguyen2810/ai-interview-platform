import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(
      `
      SELECT 
        id,
        title,
        meeting_code,
        scheduled_at,
        max_interviewers
      FROM interviews
      WHERE deleted_at IS NULL
        AND scheduled_at::date = CURRENT_DATE
      ORDER BY scheduled_at ASC
      LIMIT 2
      `,
    );

    const now = Date.now();

    const interviews = result.rows.map((i) => {
      const scheduledDate = new Date(i.scheduled_at);
      const isStarted = scheduledDate.getTime() <= now;

      return {
        id: i.id,
        title: i.title,
        meetingCode: i.meeting_code,

        // dùng cho countdown
        scheduledAt: i.scheduled_at,

        // UI display time
        scheduledTime: scheduledDate.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),

        maxInterviewers: String(i.max_interviewers),

        // 🔥 quan trọng: status realtime theo thời gian
        status: isStarted ? "ONGOING" : "SCHEDULED",

        avatar: "https://i.pravatar.cc/150",
      };
    });

    return NextResponse.json(interviews);
  } catch (err) {
    console.error("GET /interviews error:", err);

    return NextResponse.json(
      { error: "Failed to fetch interviews" },
      { status: 500 },
    );
  }
}
