// /api/admin/users — CRUD trên bảng users.
//
//   GET    list + filter + pagination (role, is_active, search email/name)
//   PATCH  toggle is_active (active/inactive) theo id
//   DELETE soft delete (set deleted_at)

import { pool } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAdmin,
  parsePagination,
  parseSearch,
  ok,
  err as apiErr,
} from "@/lib/admin-auth";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  provider: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
};

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);

  const { page, limit, offset } = parsePagination(req.url);
  const search = parseSearch(req.url);
  const role = (url.searchParams.get("role") || "").toUpperCase();
  const activeParam = url.searchParams.get("is_active");

  const conditions: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];

  if (role && ["ADMIN", "RECRUITER", "CANDIDATE"].includes(role)) {
    params.push(role);
    conditions.push(`role = $${params.length}`);
  }
  if (activeParam === "true") conditions.push("is_active = TRUE");
  if (activeParam === "false") conditions.push("is_active = FALSE");
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    conditions.push(`(email ILIKE $${idx} OR full_name ILIKE $${idx})`);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  params.push(limit, offset);
  const dataSql = `SELECT id, email, full_name, avatar_url, role, provider,
                          is_active, created_at, last_login_at
                   FROM users
                   ${where}
                   ORDER BY created_at DESC
                   LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const countSql = `SELECT COUNT(*)::int AS total FROM users ${where}`;

  try {
    const [dataRes, countRes] = await Promise.all([
      pool.query<UserRow>(dataSql, params),
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
    console.error("ADMIN USERS LIST ERROR:", e);
    return apiErr("Không thể lấy danh sách", 500);
  }
}

export async function PATCH(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: { id?: string; is_active?: boolean };
  try {
    body = await req.json();
  } catch {
    return apiErr("Body không hợp lệ");
  }

  const id = body.id;
  if (!id) return apiErr("Thiếu id");
  if (typeof body.is_active !== "boolean") {
    return apiErr("Thiếu is_active");
  }

  try {
    const res = await pool.query(
      `UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, is_active`,
      [body.is_active, id],
    );
    if (res.rows.length === 0) return apiErr("Không tìm thấy user", 404);
    return ok({ user: res.rows[0] });
  } catch (e) {
    console.error("ADMIN USERS PATCH ERROR:", e);
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
    // Không cho xoá chính mình
    if (id === auth.id) {
      return apiErr("Không thể xoá chính tài khoản admin đang đăng nhập", 400);
    }
    const res = await pool.query(
      `UPDATE users SET deleted_at = CURRENT_TIMESTAMP,
                        is_active = FALSE,
                        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id],
    );
    if (res.rows.length === 0) return apiErr("Không tìm thấy user", 404);
    return ok({ id: res.rows[0].id });
  } catch (e) {
    console.error("ADMIN USERS DELETE ERROR:", e);
    return apiErr("Không thể xoá", 500);
  }
}
