// /api/admin/messages — quản lý messages (chat trong phiên phỏng vấn).
//
//   GET    list + filter (meeting_code, session_id, type, search)
//   DELETE xoá (bảng không có deleted_at nên đây là xoá cứng)
//
// Cột thực tế trong bảng `messages`:
//   id, session_id, sender_id, guest_name, content, type,
//   created_at, meeting_code, sender_name
//
// Lưu ý: sender_id không có FK ràng buộc tới bảng users trong schema
// (chỉ có FK session_id -> interview_sessions), nên LEFT JOIN users bên
// dưới chỉ mang tính best-effort để lấy thêm email nếu có match theo id.

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
  const meetingCode = url.searchParams.get("meeting_code");

  const type = url.searchParams.get("type");

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (meetingCode) {
    params.push(meetingCode);
    conditions.push(`m.meeting_code = $${params.length}`);
  }

  if (type) {
    params.push(type.toUpperCase());
    conditions.push(`m.type = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    conditions.push(
      `(m.content ILIKE $${idx} OR m.sender_name ILIKE $${idx} OR m.guest_name ILIKE $${idx})`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(limit, offset);
  const dataSql = `
    SELECT m.id, m.session_id, m.sender_id, m.guest_name, m.sender_name,
           m.content, m.type, m.meeting_code, m.created_at,
           u.email AS sender_email
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    ${where}
    ORDER BY m.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const countSql = `SELECT COUNT(*)::int AS total FROM messages m ${where}`;

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
    console.error("ADMIN MESSAGES LIST ERROR:", e);
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
      `DELETE FROM messages WHERE id = $1 RETURNING id`,
      [id],
    );
    if (res.rows.length === 0) return apiErr("Không tìm thấy tin nhắn", 404);
    return ok({ id: res.rows[0].id });
  } catch (e) {
    console.error("ADMIN MESSAGES DELETE ERROR:", e);
    return apiErr("Không thể xoá", 500);
  }
}
