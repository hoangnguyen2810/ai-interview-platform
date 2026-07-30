// GET /api/admin/reports/[id] — fetch 1 report bao gồm content (JSONB).
//   Dùng cho modal preview trong admin UI khi click row report.

import { pool } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin, ok, err as apiErr } from "@/lib/admin-auth";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;

  try {
    const res = await pool.query(
      `SELECT r.id, r.interview_id, r.status, r.ai_overall_score, r.ai_model,
              r.content, r.cv_filename, r.coding_analysis_snapshot,
              r.generated_at, r.updated_at,
              i.title AS interview_title,
              i.meeting_code AS meeting_code,
              u.email AS created_by_email,
              u.full_name AS created_by_name
       FROM interview_reports r
       JOIN interviews i ON i.id = r.interview_id
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.id = $1 AND r.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    if (res.rows.length === 0) return apiErr("Không tìm thấy report", 404);
    const row = res.rows[0];
    return ok({
      report: {
        ...row,
        // Postgres NUMERIC/DECIMAL trả về string qua node-postgres — ép
        // sang number để FE gọi `.toFixed()` không bị crash.
        ai_overall_score:
          row.ai_overall_score != null ? Number(row.ai_overall_score) : null,
      },
    });
  } catch (e) {
    console.error("ADMIN REPORT GET ERROR:", e);
    return apiErr("Không thể lấy report", 500);
  }
}
