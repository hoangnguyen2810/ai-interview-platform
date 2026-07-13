// GET  /api/interviews/[meetingCode]/questions/available
//      → list coding_questions CHƯA được assign vào interview này (thư viện).
//      Response: { success, questions: [{ id, title, description, difficulty, createdAt, isAssigned }] }
//
// POST /api/interviews/[meetingCode]/questions/available
//      → assign question vào interview (assign via interview_questions).
//      Body: { questionId: string }

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ meetingCode: string }>;
}

// ─── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập" },
        { status: 401 },
      );
    }
    if (auth.role !== "RECRUITER" && auth.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Không có quyền" },
        { status: 403 },
      );
    }

    const { meetingCode } = await ctx.params;

    // Lấy interview_id từ meeting_code
    const interviewRes = await pool.query<{ id: string }>(
      `SELECT id FROM interviews WHERE meeting_code = $1 LIMIT 1`,
      [meetingCode],
    );
    if (!interviewRes.rows[0]) {
      return NextResponse.json(
        { success: false, message: "Phỏng vấn không tồn tại" },
        { status: 404 },
      );
    }
    const interviewId = interviewRes.rows[0].id;

    // LEFT JOIN với interview_questions để check isAssigned.
    // Chỉ lấy những question CHƯA có trong interview này (iq.id IS NULL).
    const result = await pool.query<{
      id: string;
      title: string;
      description: string;
      difficulty: "EASY" | "MEDIUM" | "HARD" | null;
      created_at: Date;
      iq_id: unknown;
    }>(
      `SELECT
         cq.id,
         cq.title,
         cq.description,
         cq.difficulty,
         cq.created_at,
         iq.id AS iq_id
       FROM coding_questions cq
       LEFT JOIN interview_questions iq
         ON iq.question_id = cq.id
        AND iq.interview_id = $1
       WHERE iq.id IS NULL
       ORDER BY cq.created_at DESC`,
      [interviewId],
    );

    const questions = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      difficulty: row.difficulty,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at,
      isAssigned: false, // đã filter rồi nên luôn false
    }));

    return NextResponse.json({ success: true, questions });
  } catch (error) {
    console.error("GET /questions/available ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}

// ─── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập" },
        { status: 401 },
      );
    }
    if (auth.role !== "RECRUITER" && auth.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Không có quyền" },
        { status: 403 },
      );
    }

    const { meetingCode } = await ctx.params;
    const body = await req.json().catch(() => null);
    const { questionId }: { questionId?: string } = body ?? {};

    if (!questionId) {
      return NextResponse.json(
        { success: false, message: "Thiếu questionId" },
        { status: 400 },
      );
    }

    const interviewRes = await pool.query<{ id: string }>(
      `SELECT id FROM interviews WHERE meeting_code = $1 LIMIT 1`,
      [meetingCode],
    );
    if (!interviewRes.rows[0]) {
      return NextResponse.json(
        { success: false, message: "Phỏng vấn không tồn tại" },
        { status: 404 },
      );
    }
    const interviewId = interviewRes.rows[0].id;

    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM interview_questions
       WHERE interview_id = $1 AND question_id = $2`,
      [interviewId, questionId],
    );
    if (existing.rows[0]) {
      return NextResponse.json(
        { success: false, message: "Câu hỏi đã được thêm" },
        { status: 409 },
      );
    }

    const orderRes = await pool.query<{ next_order: number }>(
      `SELECT COALESCE(MAX(question_order), 0) + 1 AS next_order
       FROM interview_questions WHERE interview_id = $1`,
      [interviewId],
    );
    const nextOrder = orderRes.rows[0].next_order;

    await pool.query(
      `INSERT INTO interview_questions (interview_id, question_id, question_order)
       VALUES ($1, $2, $3)`,
      [interviewId, questionId, nextOrder],
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("POST /questions/available ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}
