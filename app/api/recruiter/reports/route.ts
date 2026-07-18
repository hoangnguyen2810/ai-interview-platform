// API Route: /api/recruiter/reports
//
// GET    → List tất cả interview_reports của recruiter hiện tại (joined với
//          interviews + interview_candidates để lấy tên ứng viên + tên buổi
//          phỏng vấn). Trả về danh sách phẳng phù hợp với trang
//          /recruiter/reports (5 cột: candidate, interview, score, status, time).
//
// DELETE → Soft-delete một hoặc nhiều report theo body { ids: string[] }.
//          Chỉ xoá các report thuộc về những interview mà recruiter là HOST.
//
// Permission: chỉ RECRUITER (ADMIN cho qua).

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { forbidden, getAuthUserFromRequest, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

interface ReportListRow {
  id: string;
  candidate_name: string | null;
  interview_title: string | null;
  meeting_code: string;
  ai_overall_score: string | number | null;
  status: "DRAFT" | "EDITED" | "FINAL";
  generated_at: Date | string;
}

function normalizeScore(v: string | number | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (Number.isNaN(n)) return null;
  return n;
}

export async function GET(req: Request) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();
    if (auth.role !== "RECRUITER" && auth.role !== "ADMIN") {
      return forbidden("Chỉ tài khoản Recruiter mới truy cập được");
    }

    const result = await pool.query<ReportListRow>(
      `SELECT
         r.id,
         ic.candidate_name,
         i.title           AS interview_title,
         i.meeting_code,
         r.ai_overall_score,
         r.status,
         r.generated_at
       FROM interview_reports r
       JOIN interviews i
         ON i.id = r.interview_id
        AND i.deleted_at IS NULL
       LEFT JOIN interview_candidates ic
         ON ic.interview_id = i.id
       WHERE r.deleted_at IS NULL
         AND (
           $2 = true  -- ADMIN: xem tất cả
           OR EXISTS (
             SELECT 1 FROM interview_participants ip
             WHERE ip.interview_id = i.id
               AND ip.user_id = $1
               AND ip.participant_role = 'HOST'
           )
         )
       ORDER BY r.generated_at DESC`,
      [auth.id, auth.role === "ADMIN"],
    );

    return NextResponse.json({
      success: true,
      reports: result.rows.map((r) => ({
        id: r.id,
        candidateName: r.candidate_name ?? "",
        interviewTitle: r.interview_title ?? "",
        meetingCode: r.meeting_code,
        aiOverallScore: normalizeScore(r.ai_overall_score),
        status: r.status,
        generatedAt:
          r.generated_at instanceof Date
            ? r.generated_at.toISOString()
            : String(r.generated_at),
      })),
    });
  } catch (error) {
    console.error("GET /api/recruiter/reports ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi máy chủ" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();
    if (auth.role !== "RECRUITER" && auth.role !== "ADMIN") {
      return forbidden("Chỉ tài khoản Recruiter mới thực hiện được");
    }

    const body = await req.json().catch(() => null);
    const ids: unknown = body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, message: "Thiếu danh sách ids" },
        { status: 400 },
      );
    }
    // Chỉ chấp nhận string UUID để tránh SQL injection khi build câu query.
    const cleanIds = ids.filter(
      (x): x is string => typeof x === "string" && x.length > 0 && x.length < 80,
    );
    if (cleanIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "Danh sách ids không hợp lệ" },
        { status: 400 },
      );
    }

    // Soft-delete bằng cách set deleted_at; chỉ áp dụng với các report mà
    // recruiter hiện tại có quyền truy cập (HOST của interview hoặc ADMIN).
    const result = await pool.query(
      `UPDATE interview_reports r
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           updated_by = $1
       FROM interviews i
       WHERE r.interview_id = i.id
         AND r.deleted_at IS NULL
         AND r.id = ANY($2::uuid[])
         AND (
           $3 = true
           OR EXISTS (
             SELECT 1 FROM interview_participants ip
             WHERE ip.interview_id = i.id
               AND ip.user_id = $1
               AND ip.participant_role = 'HOST'
           )
         )
       RETURNING r.id`,
      [auth.id, cleanIds, auth.role === "ADMIN"],
    );

    return NextResponse.json({
      success: true,
      deletedCount: result.rowCount ?? 0,
    });
  } catch (error) {
    console.error("DELETE /api/recruiter/reports ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi máy chủ" },
      { status: 500 },
    );
  }
}
