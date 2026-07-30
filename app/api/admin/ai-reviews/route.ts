// /api/admin/ai-reviews — quản lý ai_reviews.
//
//   GET    list + filter (model_name, score range)
//   DELETE xoá (cascade submission_id ON DELETE CASCADE)
//
// Cột thực tế trong bảng `ai_reviews`:
//   id, submission_id, score, strengths, weaknesses, feedback, created_at,
//   correctness_score, algorithm_score, time_complexity, space_complexity,
//   overall_score, hint, model_name, raw_analysis, reviewed_at,
//   execution_mode, analysis_confidence, analysis_reason,
//   analysis_entry_point, uses_hardcoded_values
//
// Lưu ý: bảng KHÔNG có cột `correctness` / `algorithm` (chỉ có
// correctness_score / algorithm_score) — đã bỏ khỏi SELECT bên dưới.

import { pool } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAdmin,
  parsePagination,
  parseSearch,
  ok,
  err as apiErr,
} from "@/lib/admin-auth";

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const { page, limit, offset } = parsePagination(req.url);
  const search = parseSearch(req.url);
  const modelName = url.searchParams.get("model_name");
  const minScore = parseFloat(url.searchParams.get("min_score") || "");
  const maxScore = parseFloat(url.searchParams.get("max_score") || "");

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (modelName) {
    params.push(modelName);
    conditions.push(`r.model_name = $${params.length}`);
  }
  if (Number.isFinite(minScore)) {
    params.push(minScore);
    conditions.push(`r.overall_score >= $${params.length}`);
  }
  if (Number.isFinite(maxScore)) {
    params.push(maxScore);
    conditions.push(`r.overall_score <= $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    conditions.push(
      `(r.feedback ILIKE $${idx} OR r.strengths ILIKE $${idx} OR r.weaknesses ILIKE $${idx})`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(limit, offset);
  const dataSql = `
    SELECT r.id, r.submission_id, r.score, r.correctness_score, r.algorithm_score,
           r.overall_score, r.time_complexity, r.space_complexity,
           r.strengths, r.weaknesses, r.feedback, r.hint,
           r.model_name, r.raw_analysis, r.reviewed_at, r.created_at,
           r.execution_mode, r.analysis_confidence, r.analysis_reason,
           r.analysis_entry_point, r.uses_hardcoded_values,
           cs.candidate_name, cs.language, cs.question_id,
           q.title AS question_title
    FROM ai_reviews r
    JOIN code_submissions cs ON cs.id = r.submission_id
    LEFT JOIN coding_questions q ON q.id = cs.question_id
    ${where}
    ORDER BY r.reviewed_at DESC NULLS LAST, r.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const countSql = `SELECT COUNT(*)::int AS total FROM ai_reviews r ${where}`;

  try {
    const [dataRes, countRes] = await Promise.all([
      pool.query(dataSql, params),
      pool.query<{ total: number }>(
        countSql,
        params.slice(0, params.length - 2),
      ),
    ]);
    return ok({
      data: dataRes.rows,
      pagination: { page, limit, total: countRes.rows[0].total },
    });
  } catch (e) {
    console.error("ADMIN AI REVIEWS LIST ERROR:", e);
    return apiErr("Không thể lấy danh sách", 500);
  }
}

export async function DELETE(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return apiErr("Thiếu id");

  try {
    const res = await pool.query(
      `DELETE FROM ai_reviews WHERE id = $1 RETURNING id`,
      [id],
    );
    if (res.rows.length === 0) return apiErr("Không tìm thấy review", 404);
    return ok({ id: res.rows[0].id });
  } catch (e) {
    console.error("ADMIN AI REVIEWS DELETE ERROR:", e);
    return apiErr("Không thể xoá", 500);
  }
}
