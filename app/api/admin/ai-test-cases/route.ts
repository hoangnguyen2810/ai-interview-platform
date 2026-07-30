// /api/admin/ai-test-cases — quản lý ai_generated_test_cases.
//
//   GET    list + filter (status, edge_case_type, submission_id)
//   DELETE xoá

import { pool } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAdmin,
  parsePagination,
  parseSearch,
  ok,
  err as apiErr,
} from "@/lib/admin-auth";

const ALLOWED_STATUS = new Set([
  "PENDING",
  "PASSED",
  "FAILED",
  "RUNTIME_ERROR",
  "TIMEOUT",
]);

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const { page, limit, offset } = parsePagination(req.url);
  const search = parseSearch(req.url);
  const status = (url.searchParams.get("status") || "").toUpperCase();
  const edgeCaseType = url.searchParams.get("edge_case_type");
  const submissionId = url.searchParams.get("submission_id");

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status && ALLOWED_STATUS.has(status)) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (edgeCaseType) {
    params.push(edgeCaseType);
    conditions.push(`t.edge_case_type = $${params.length}`);
  }
  if (submissionId) {
    params.push(submissionId);
    conditions.push(`t.submission_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    conditions.push(`t.description ILIKE $${idx}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(limit, offset);
  const dataSql = `
    SELECT t.id, t.submission_id, t.input_data, t.expected_output,
           t.description, t.edge_case_type, t.status, t.actual_output,
           t.runtime_ms, t.execution_order, t.created_at,
           cs.candidate_name, cs.language, cs.question_id,
           q.title AS question_title
    FROM ai_generated_test_cases t
    JOIN code_submissions cs ON cs.id = t.submission_id
    LEFT JOIN coding_questions q ON q.id = cs.question_id
    ${where}
    ORDER BY t.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const countSql = `SELECT COUNT(*)::int AS total
                    FROM ai_generated_test_cases t
                    JOIN code_submissions cs ON cs.id = t.submission_id
                    ${where}`;

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
    console.error("ADMIN AI TEST CASES LIST ERROR:", e);
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
      `DELETE FROM ai_generated_test_cases WHERE id = $1 RETURNING id`,
      [id],
    );
    if (res.rows.length === 0) return apiErr("Không tìm thấy test case", 404);
    return ok({ id: res.rows[0].id });
  } catch (e) {
    console.error("ADMIN AI TEST CASES DELETE ERROR:", e);
    return apiErr("Không thể xoá", 500);
  }
}
