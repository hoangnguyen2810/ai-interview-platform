// /api/admin/reports — CRUD trên bảng interview_reports.
//
//   GET    list + filter (status, interview_id)
//   PATCH  update status + ai_overall_score
//   DELETE soft delete

import { pool } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAdmin,
  parsePagination,
  parseSearch,
  ok,
  err as apiErr,
} from "@/lib/admin-auth";

const ALLOWED_STATUS = new Set(["DRAFT", "EDITED", "FINAL"]);

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const { page, limit, offset } = parsePagination(req.url);
  const search = parseSearch(req.url);
  const status = (url.searchParams.get("status") || "").toUpperCase();
  const interviewId = url.searchParams.get("interview_id");

  const conditions: string[] = ["r.deleted_at IS NULL"];
  const params: unknown[] = [];

  if (status && ALLOWED_STATUS.has(status)) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (interviewId) {
    params.push(interviewId);
    conditions.push(`r.interview_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    conditions.push(`(i.title ILIKE $${idx} OR i.meeting_code ILIKE $${idx})`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  params.push(limit, offset);
  const dataSql = `
    SELECT r.id, r.interview_id, r.status, r.ai_overall_score, r.ai_model,
           r.generated_at, r.updated_at, r.created_at,
           i.title AS interview_title,
           i.meeting_code AS meeting_code,
           u.email AS created_by_email,
           u.full_name AS created_by_name,
           jsonb_pretty(r.content) AS content
    FROM interview_reports r
    JOIN interviews i ON i.id = r.interview_id
    LEFT JOIN users u ON u.id = r.created_by
    ${where}
    ORDER BY r.generated_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const countSql = `SELECT COUNT(*)::int AS total FROM interview_reports r
                    JOIN interviews i ON i.id = r.interview_id
                    ${where}`;

  try {
    const [dataRes, countRes] = await Promise.all([
      pool.query(dataSql, params),
      pool.query<{ total: number }>(
        countSql,
        params.slice(0, params.length - 2),
      ),
    ]);

    const rows = dataRes.rows.map((r) => ({
      ...r,
      // Postgres NUMERIC/DECIMAL trả về dạng string qua node-postgres
      // (để tránh mất độ chính xác) — phải ép sang number ở đây, nếu
      // không FE gọi `.toFixed()` sẽ crash vì nhận được string.
      ai_overall_score:
        r.ai_overall_score != null ? Number(r.ai_overall_score) : null,
      content: undefined,
    }));

    return ok({
      data: rows,
      pagination: { page, limit, total: countRes.rows[0].total },
    });
  } catch (e) {
    console.error("ADMIN REPORTS LIST ERROR:", e);
    return apiErr("Không thể lấy danh sách", 500);
  }
}

export async function PATCH(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: {
    id?: string;
    status?: string;
    ai_overall_score?: number;
  };
  try {
    body = await req.json();
  } catch {
    return apiErr("Body không hợp lệ");
  }
  const id = body.id;
  if (!id) return apiErr("Thiếu id");

  const sets: string[] = [];
  const params: unknown[] = [];

  if (body.status) {
    const status = body.status.toUpperCase();
    if (!ALLOWED_STATUS.has(status)) return apiErr("Status không hợp lệ");
    params.push(status);
    sets.push(`status = $${params.length}`);
  }
  if (typeof body.ai_overall_score === "number") {
    params.push(body.ai_overall_score);
    sets.push(`ai_overall_score = $${params.length}`);
  }
  if (sets.length === 0) return apiErr("Không có trường nào để cập nhật");

  params.push(id);
  const sql = `UPDATE interview_reports SET ${sets.join(", ")}, updated_by = $${
    params.length + 1
  }, updated_at = CURRENT_TIMESTAMP
               WHERE id = $${params.length} AND deleted_at IS NULL
               RETURNING id, status, ai_overall_score`;
  params.push(auth.id);

  try {
    const res = await pool.query(sql, params);
    if (res.rows.length === 0) return apiErr("Không tìm thấy report", 404);
    const row = res.rows[0];
    return ok({
      report: {
        ...row,
        ai_overall_score:
          row.ai_overall_score != null ? Number(row.ai_overall_score) : null,
      },
    });
  } catch (e) {
    console.error("ADMIN REPORTS PATCH ERROR:", e);
    return apiErr("Không thể cập nhật", 500);
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
      `UPDATE interview_reports SET deleted_at = CURRENT_TIMESTAMP,
                                    updated_by = $2,
                                    updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id, auth.id],
    );
    if (res.rows.length === 0) return apiErr("Không tìm thấy report", 404);
    return ok({ id: res.rows[0].id });
  } catch (e) {
    console.error("ADMIN REPORTS DELETE ERROR:", e);
    return apiErr("Không thể xoá", 500);
  }
}
