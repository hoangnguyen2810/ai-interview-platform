// GET /api/recordings/latest
//
// Trả về callCid của cuộc phỏng vấn MỚI NHẤT mà user hiện tại là
// HOST/INTERVIEWER (hoặc admin xem tất cả). Mục đích: làm nguồn cho nút
// "Đồng bộ recording mới nhất" trên UI /recruiter/recordings — recruiter
// không cần nhập tay callCid nữa.
//
// Logic "mới nhất": ORDER BY interviews.created_at DESC, bỏ qua
// interviews đã soft-delete.
//
// Response:
//   {
//     success: true,
//     callCid: "default:NC-23G6KRA3",  // hoặc null nếu chưa có
//     meetingCode: "NC-23G6KRA3",
//     title: "Interview XYZ",
//     status: "FINISHED",
//     createdAt: "2026-07-11T..."
//   }

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LatestInterviewRow {
  id: string;
  title: string;
  meeting_code: string;
  status: string;
  created_at: Date | string;
}

export async function GET(req: Request) {
  try {
    // 1. Auth.
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();

    // 2. Query interview mới nhất mà user là HOST/INTERVIEWER.
    //    Admin xem tất cả (không filter theo participant).
    //    Candidate không có quyền sync recordings nên trả 403.
    if (auth.role !== "RECRUITER" && auth.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          callCid: null,
          message:
            "Chỉ recruiter / admin mới có thể đồng bộ recording mới nhất",
        },
        { status: 403 },
      );
    }

    let row: LatestInterviewRow | undefined;

    if (auth.role === "ADMIN") {
      const res = await pool.query<LatestInterviewRow>(
        `SELECT id, title, meeting_code, status, created_at
         FROM interviews
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
      );
      row = res.rows[0];
    } else {
      // RECRUITER: chỉ lấy interview user là HOST/INTERVIEWER.
      // Dùng INNER JOIN interview_participants để filter quyền — không
      // dựa vào interviews.recruiter_id (không tồn tại trong schema).
      const res = await pool.query<LatestInterviewRow>(
        `SELECT i.id, i.title, i.meeting_code, i.status, i.created_at
         FROM interviews i
         INNER JOIN interview_participants ip
           ON ip.interview_id = i.id
         WHERE i.deleted_at IS NULL
           AND ip.user_id = $1
           AND ip.participant_role IN ('HOST', 'INTERVIEWER')
         ORDER BY i.created_at DESC
         LIMIT 1`,
        [auth.id],
      );
      row = res.rows[0];
    }

    if (!row) {
      return NextResponse.json(
        {
          success: true,
          callCid: null,
          meetingCode: null,
          title: null,
          status: null,
          createdAt: null,
          message:
            auth.role === "ADMIN"
              ? "Chưa có interview nào trong hệ thống"
              : "Bạn chưa từng host/interview bất kỳ interview nào",
        },
        { status: 200 },
      );
    }

    // callCid theo convention "default:<meeting_code>" (xem lib/streamClient.ts
    // và app/interview/room). Tách `:id` để tránh hard-code callType ở đây.
    const callCid = `default:${row.meeting_code}`;

    return NextResponse.json(
      {
        success: true,
        callCid,
        meetingCode: row.meeting_code,
        title: row.title,
        status: row.status,
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/recordings/latest ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        callCid: null,
        message:
          error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}
