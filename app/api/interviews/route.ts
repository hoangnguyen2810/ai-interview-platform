import { NextResponse } from "next/server";
import { forbidden, getAuthUserFromRequest, unauthorized } from "@/lib/auth";
import { ValidationError, validateCreateInterviewPayload } from "./dto";
import { createInterviewForRecruiter } from "./service";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/interviews
 *
 * Trả về TOÀN BỘ buổi phỏng vấn của recruiter hiện tại (không giới hạn ngày).
 * Dùng cho trang /recruiter/interviews (Quản lý phỏng vấn).
 *
 * Hỗ trợ query params:
 *   - status: SCHEDULED | ONGOING | FINISHED | CANCELLED (lọc theo trạng thái)
 *   - search: tiêu đề hoặc meeting_code (ILIKE)
 *   - duration: 30 | 60 | 90 | 120 (lọc theo duration_minutes)
 *   - limit: mặc định 100
 *
 * Trả:
 *   {
 *     interviews: InterviewListItem[],
 *     stats: { total, scheduled, ongoing, finished },
 *     total: number
 *   }
 */
export async function GET(req: Request) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();
    if (auth.role !== "RECRUITER") {
      return forbidden("Chỉ tài khoản Recruiter mới xem được danh sách này");
    }

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status")?.toUpperCase() ?? null;
    const search = url.searchParams.get("search")?.trim() ?? "";
    const durationFilter = url.searchParams.get("duration");
    const limit = Math.min(
      500,
      Math.max(1, Number(url.searchParams.get("limit") ?? "100")),
    );

    const validStatuses = ["SCHEDULED", "ONGOING", "FINISHED", "CANCELLED"];
    if (statusFilter && !validStatuses.includes(statusFilter)) {
      return NextResponse.json(
        { success: false, message: "status không hợp lệ" },
        { status: 400 },
      );
    }

    // Build dynamic WHERE
    const conditions: string[] = [
      "i.deleted_at IS NULL",
      "ip.user_id = $1",
      "ip.participant_role = 'HOST'",
    ];
    const params: (string | number)[] = [auth.id];

    if (statusFilter) {
      conditions.push(`i.status = $${params.length + 1}`);
      params.push(statusFilter);
    }

    if (search) {
      conditions.push(
        `(i.title ILIKE $${params.length + 1} OR i.meeting_code ILIKE $${params.length + 1})`,
      );
      params.push(`%${search}%`);
    }

    if (
      durationFilter &&
      /^(30|60|90|120)$/.test(durationFilter)
    ) {
      conditions.push(`i.duration_minutes = $${params.length + 1}`);
      params.push(Number(durationFilter));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // Lấy data phân trang + filter
    const listResult = await pool.query<{
      id: string;
      title: string;
      meeting_code: string;
      status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";
      duration_minutes: number;
      scheduled_at: Date | string;
      max_interviewers: number;
    }>(
      `
      SELECT
        i.id,
        i.title,
        i.meeting_code,
        i.status,
        i.duration_minutes,
        i.scheduled_at,
        i.max_interviewers
      FROM interviews i
      JOIN interview_participants ip ON ip.interview_id = i.id
      ${whereClause}
      ORDER BY i.scheduled_at DESC
      LIMIT $${params.length + 1}
      `,
      [...params, limit],
    );

    // Stats: đếm theo từng status + số liệu thời gian (KHÔNG filter status — luôn tính trên toàn bộ của recruiter)
    const statsResult = await pool.query<{
      total: string;
      scheduled: string;
      ongoing: string;
      finished: string;
      this_month: string;
      today: string;
    }>(
      `
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE i.status = 'SCHEDULED')::text AS scheduled,
        COUNT(*) FILTER (WHERE i.status = 'ONGOING')::text   AS ongoing,
        COUNT(*) FILTER (WHERE i.status = 'FINISHED')::text  AS finished,
        COUNT(*) FILTER (
          WHERE date_trunc('month', i.scheduled_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
              = date_trunc('month', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
        )::text AS this_month,
        COUNT(*) FILTER (
          WHERE (i.scheduled_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
              = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
        )::text AS today
      FROM interviews i
      JOIN interview_participants ip ON ip.interview_id = i.id
      WHERE i.deleted_at IS NULL
        AND ip.user_id = $1
        AND ip.participant_role = 'HOST'
      `,
      [auth.id],
    );

    const statsRow = statsResult.rows[0] ?? {
      total: "0",
      scheduled: "0",
      ongoing: "0",
      finished: "0",
      this_month: "0",
      today: "0",
    };

    const interviews = listResult.rows.map((row) => {
      const scheduledAt =
        row.scheduled_at instanceof Date
          ? row.scheduled_at
          : new Date(row.scheduled_at);

      // Format: "23 Jun 2026 - 14:00"
      const datePart = scheduledAt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const timePart = scheduledAt.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });

      return {
        id: row.id,
        title: row.title,
        code: row.meeting_code,
        status: row.status,
        duration: row.duration_minutes,
        time: `${datePart} - ${timePart}`,
        interviewers: row.max_interviewers,
        scheduledAt:
          scheduledAt instanceof Date
            ? scheduledAt.toISOString()
            : String(scheduledAt),
      };
    });

    return NextResponse.json({
      success: true,
      interviews,
      total: Number(statsRow.total),
      stats: {
        total: Number(statsRow.total),
        scheduled: Number(statsRow.scheduled),
        ongoing: Number(statsRow.ongoing),
        finished: Number(statsRow.finished),
        thisMonth: Number(statsRow.this_month),
        today: Number(statsRow.today),
      },
    });
  } catch (error) {
    console.error("GET /api/interviews ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    // 1. Auth: chỉ recruiter mới tạo được phòng phỏng vấn
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();
    if (auth.role !== "RECRUITER") {
      return forbidden("Chỉ tài khoản Recruiter mới tạo được phòng phỏng vấn");
    }

    // 2. Parse + validate body
    const raw = await req.json().catch(() => null);
    if (raw === null) {
      return NextResponse.json(
        { success: false, message: "Body phải là JSON hợp lệ" },
        { status: 400 },
      );
    }

    let input;
    try {
      input = validateCreateInterviewPayload(raw);
    } catch (e) {
      if (e instanceof ValidationError) {
        return NextResponse.json(
          { success: false, message: e.message, field: e.field },
          { status: 400 },
        );
      }
      throw e;
    }

    // 3. Tạo interview + thêm host trong transaction
    const interview = await createInterviewForRecruiter(auth.id, input);

    return NextResponse.json(
      {
        success: true,
        message: "Tạo phòng phỏng vấn thành công",
        interview,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/interviews ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}
