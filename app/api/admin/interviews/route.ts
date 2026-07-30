// /api/admin/interviews — CRUD trên bảng interviews.
//
//   GET    list (status filter, date filter, search title/code)
//   PATCH  update status
//   DELETE soft delete (deleted_at)

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
  "SCHEDULED",
  "ONGOING",
  "FINISHED",
  "CANCELLED",
]);

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const { page, limit, offset } = parsePagination(req.url);
  const search = parseSearch(req.url);
  const status = (url.searchParams.get("status") || "").toUpperCase();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const conditions: string[] = ["i.deleted_at IS NULL"];
  const params: unknown[] = [];

  if (status && ALLOWED_STATUS.has(status)) {
    params.push(status);
    conditions.push(`i.status = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`i.scheduled_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`i.scheduled_at <= $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    conditions.push(
      `(i.title ILIKE $${idx} OR i.meeting_code ILIKE $${idx})`,
    );
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  params.push(limit, offset);
  const dataSql = `
    SELECT i.id, i.title, i.meeting_code, i.status,
           i.scheduled_at, i.started_at, i.ended_at,
           i.duration_minutes, i.enable_recording,
           i.created_at,
           u.email AS recruiter_email,
           u.full_name AS recruiter_name
    FROM interviews i
    LEFT JOIN interview_participants ip
      ON ip.interview_id = i.id AND ip.participant_role = 'HOST'
    LEFT JOIN users u ON u.id = ip.user_id
    ${where}
    ORDER BY i.scheduled_at DESC NULLS LAST
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const countSql = `SELECT COUNT(*)::int AS total FROM interviews i ${where}`;

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
    console.error("ADMIN INTERVIEWS LIST ERROR:", e);
    return apiErr("Không thể lấy danh sách", 500);
  }
}

export async function PATCH(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: { id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return apiErr("Body không hợp lệ");
  }
  const id = body.id;
  const status = (body.status || "").toUpperCase();
  if (!id || !ALLOWED_STATUS.has(status)) {
    return apiErr("Thiếu id hoặc status không hợp lệ");
  }

  try {
    const res = await pool.query(
      `UPDATE interviews SET status = $1 WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, status`,
      [status, id],
    );
    if (res.rows.length === 0) return apiErr("Không tìm thấy buổi phỏng vấn", 404);
    return ok({ interview: res.rows[0] });
  } catch (e) {
    console.error("ADMIN INTERVIEWS PATCH ERROR:", e);
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
      `UPDATE interviews SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id],
    );
    if (res.rows.length === 0) return apiErr("Không tìm thấy buổi phỏng vấn", 404);
    return ok({ id: res.rows[0].id });
  } catch (e) {
    console.error("ADMIN INTERVIEWS DELETE ERROR:", e);
    return apiErr("Không thể xoá", 500);
  }
}
