// GET /api/admin/stats
//
// Aggregate counts across main tables for the admin landing dashboard.
// Returns a single payload with both total counts and per-status breakdowns.
//
// Lưu ý: bảng `recordings` không có cột `status` (chỉ có `recording_type`
// và `deleted_at`) — breakdown cho recordings dùng `recording_type` thay
// vì `status`.

import { pool } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin, err as apiErr } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const [
      usersTotal,
      usersByRole,
      interviewsByStatus,
      interviewsTotal,
      recordingsTotal,
      recordingsByType,
      questionsTotal,
      aiReviewsTotal,
      reportsTotal,
      reportsByStatus,
      aiTestCasesTotal,
    ] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM users WHERE deleted_at IS NULL`,
      ),
      pool.query<{ role: string; count: string }>(
        `SELECT role, COUNT(*)::int AS count FROM users
         WHERE deleted_at IS NULL GROUP BY role`,
      ),
      pool.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::int AS count FROM interviews
         WHERE deleted_at IS NULL GROUP BY status`,
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM interviews
         WHERE deleted_at IS NULL`,
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM recordings
         WHERE deleted_at IS NULL`,
      ),
      pool.query<{ recording_type: string | null; count: string }>(
        `SELECT recording_type, COUNT(*)::int AS count FROM recordings
         WHERE deleted_at IS NULL GROUP BY recording_type`,
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM coding_questions`,
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM ai_reviews`,
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM interview_reports
         WHERE deleted_at IS NULL`,
      ),
      pool.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::int AS count FROM interview_reports
         WHERE deleted_at IS NULL GROUP BY status`,
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM ai_generated_test_cases`,
      ),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        users: {
          total: usersTotal.rows[0].count,
          byRole: Object.fromEntries(
            usersByRole.rows.map((r) => [r.role, r.count]),
          ),
        },
        interviews: {
          total: interviewsTotal.rows[0].count,
          byStatus: Object.fromEntries(
            interviewsByStatus.rows.map((r) => [r.status, r.count]),
          ),
        },
        recordings: {
          total: recordingsTotal.rows[0].count,
          byType: Object.fromEntries(
            recordingsByType.rows.map((r) => [
              r.recording_type ?? "unknown",
              r.count,
            ]),
          ),
        },
        questions: {
          total: questionsTotal.rows[0].count,
        },
        aiReviews: {
          total: aiReviewsTotal.rows[0].count,
        },
        reports: {
          total: reportsTotal.rows[0].count,
          byStatus: Object.fromEntries(
            reportsByStatus.rows.map((r) => [r.status, r.count]),
          ),
        },
        aiTestCases: {
          total: aiTestCasesTotal.rows[0].count,
        },
      },
    });
  } catch (e) {
    console.error("ADMIN STATS ERROR:", e);
    return apiErr("Không thể lấy thống kê", 500);
  }
}
