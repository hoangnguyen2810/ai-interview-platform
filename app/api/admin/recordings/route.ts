// /api/admin/recordings — quản lý recordings.
//
//   GET    list + filter (call_cid, interview_id, recording_type, search)
//   DELETE hard delete (bảng recordings không có cột deleted_at)
//
// Cột thực tế trong bảng `recordings` (sau migration thêm deleted_at):
//   id, call_cid, url, filename, duration, recording_type,
//   created_at, interview_id, interview_title, deleted_at
//
// Lưu ý: bảng vẫn KHÔNG có các cột status, title, file_name, file_url,
// mime_type, size_bytes, duration_seconds, updated_at, recorded_by
// — nên các tính năng liên quan (filter theo status, join users)
// vẫn không có trong route này. deleted_at đã được thêm qua
// migration_add_deleted_at.sql để hỗ trợ soft delete.

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
  const callCid = url.searchParams.get("call_cid");
  const interviewId = url.searchParams.get("interview_id");
  const recordingType = url.searchParams.get("recording_type");

  const conditions: string[] = ["r.deleted_at IS NULL"];
  const params: unknown[] = [];

  if (callCid) {
    params.push(callCid);
    conditions.push(`r.call_cid = $${params.length}`);
  }
  if (interviewId) {
    params.push(interviewId);
    conditions.push(`r.interview_id = $${params.length}`);
  }
  if (recordingType) {
    params.push(recordingType);
    conditions.push(`r.recording_type = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    conditions.push(
      `(r.filename ILIKE $${idx} OR r.interview_title ILIKE $${idx} OR r.call_cid ILIKE $${idx})`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(limit, offset);
  const dataSql = `
    SELECT r.id, r.interview_id, r.interview_title, r.call_cid,
           r.filename, r.url, r.duration, r.recording_type,
           r.created_at
    FROM recordings r
    ${where}
    ORDER BY r.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const countSql = `SELECT COUNT(*)::int AS total FROM recordings r ${where}`;

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
    console.error("ADMIN RECORDINGS LIST ERROR:", e);
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
      `UPDATE recordings
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id],
    );
    if (res.rows.length === 0) return apiErr("Không tìm thấy bản ghi", 404);
    return ok({ id: res.rows[0].id });
  } catch (e) {
    console.error("ADMIN RECORDINGS DELETE ERROR:", e);
    return apiErr("Không thể xoá", 500);
  }
}
