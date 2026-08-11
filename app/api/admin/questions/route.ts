// /api/admin/questions — CRUD trên coding_questions.
//
//   GET    list + filter difficulty + search
//   POST   tạo mới
//   PATCH  cập nhật
//   DELETE xoá (cascade interview_questions)
//
// LƯU Ý: bảng `test_cases` không tồn tại trong schema hiện tại (chỉ có
// `ai_generated_test_cases`, khóa theo submission_id chứ không phải
// question_id). Đã bỏ mọi tham chiếu tới `test_cases` để tránh lỗi
// "relation test_cases does not exist" -> 500. Nếu bảng test case theo
// câu hỏi cần tồn tại, tạo bảng đó trước rồi khôi phục lại đoạn subquery
// (test_case_count) và câu DELETE tương ứng.

import { pool } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAdmin,
  parsePagination,
  parseSearch,
  ok,
  err as apiErr,
} from "@/lib/admin-auth";

const ALLOWED_DIFFICULTY = new Set(["EASY", "MEDIUM", "HARD"]);

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const { page, limit, offset } = parsePagination(req.url);
  const search = parseSearch(req.url);
  const difficulty = (url.searchParams.get("difficulty") || "").toUpperCase();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (difficulty && ALLOWED_DIFFICULTY.has(difficulty)) {
    params.push(difficulty);
    conditions.push(`difficulty = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(limit, offset);
  const dataSql = `
    SELECT q.id, q.title, q.description, q.difficulty, q.created_at,
           u.email AS created_by_email,
           u.full_name AS created_by_name
    FROM coding_questions q
    LEFT JOIN users u ON u.id = q.created_by
    ${where}
    ORDER BY q.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const countSql = `SELECT COUNT(*)::int AS total FROM coding_questions q
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
    console.error("ADMIN QUESTIONS LIST ERROR:", e);
    return apiErr("Không thể lấy danh sách", 500);
  }
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: {
    title?: string;
    description?: string;
    difficulty?: string;
  };
  try {
    body = await req.json();
  } catch {
    return apiErr("Body không hợp lệ");
  }
  const title = (body.title || "").trim();
  const description = (body.description || "").trim();
  const difficulty = (body.difficulty || "").toUpperCase();

  if (!title || !description) return apiErr("Thiếu title hoặc description");
  if (!ALLOWED_DIFFICULTY.has(difficulty)) {
    return apiErr("Difficulty không hợp lệ");
  }

  try {
    const res = await pool.query(
      `INSERT INTO coding_questions (title, description, difficulty, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, description, difficulty, created_at`,
      [title, description, difficulty, auth.id],
    );
    return ok({ question: res.rows[0] }, { status: 201 });
  } catch (e) {
    console.error("ADMIN QUESTIONS CREATE ERROR:", e);
    return apiErr("Không thể tạo câu hỏi", 500);
  }
}

export async function PATCH(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: {
    id?: string;
    title?: string;
    description?: string;
    difficulty?: string;
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

  if (body.title !== undefined) {
    params.push(body.title.trim());
    sets.push(`title = $${params.length}`);
  }
  if (body.description !== undefined) {
    params.push(body.description.trim());
    sets.push(`description = $${params.length}`);
  }
  if (body.difficulty !== undefined) {
    const d = body.difficulty.toUpperCase();
    if (!ALLOWED_DIFFICULTY.has(d)) return apiErr("Difficulty không hợp lệ");
    params.push(d);
    sets.push(`difficulty = $${params.length}`);
  }
  if (sets.length === 0) return apiErr("Không có trường nào để cập nhật");

  params.push(id);
  const sql = `UPDATE coding_questions SET ${sets.join(", ")}
               WHERE id = $${params.length}
               RETURNING id, title, difficulty`;
  try {
    const res = await pool.query(sql, params);
    if (res.rows.length === 0) return apiErr("Không tìm thấy câu hỏi", 404);
    return ok({ question: res.rows[0] });
  } catch (e) {
    console.error("ADMIN QUESTIONS PATCH ERROR:", e);
    return apiErr("Không thể cập nhật", 500);
  }
}

export async function DELETE(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return apiErr("Thiếu id");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // interview_questions.question_id -> coding_questions có FK nhưng
    // ON DELETE NO ACTION, nên vẫn cần xoá thủ công trước.
    await client.query(
      `DELETE FROM interview_questions WHERE question_id = $1`,
      [id],
    );
    const res = await client.query(
      `DELETE FROM coding_questions WHERE id = $1 RETURNING id`,
      [id],
    );
    if (res.rows.length === 0) {
      await client.query("ROLLBACK");
      return apiErr("Không tìm thấy câu hỏi", 404);
    }
    await client.query("COMMIT");
    return ok({ id: res.rows[0].id });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("ADMIN QUESTIONS DELETE ERROR:", e);
    return apiErr("Không thể xoá", 500);
  } finally {
    client.release();
  }
}
