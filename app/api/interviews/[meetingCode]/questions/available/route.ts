// POST /api/interviews/[meetingCode]/questions/available
// Add a coding question to an interview (assigns it via interview_questions)

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ meetingCode: string }>;
}

export async function POST(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ success: false, message: "Chưa đăng nhập" }, { status: 401 });
    }

    if (auth.role !== "RECRUITER" && auth.role !== "ADMIN") {
      return NextResponse.json({ success: false, message: "Không có quyền" }, { status: 403 });
    }

    const { meetingCode } = await ctx.params;
    const body = await req.json().catch(() => null);
    const { questionId }: { questionId?: string } = body ?? {};

    if (!questionId) {
      return NextResponse.json({ success: false, message: "Thiếu questionId" }, { status: 400 });
    }

    // Get interview id from meeting code
    const interviewRes = await pool.query(
      `SELECT id FROM interviews WHERE meeting_code = $1`,
      [meetingCode],
    );
    if (!interviewRes.rows[0]) {
      return NextResponse.json({ success: false, message: "Phỏng vấn không tồn tại" }, { status: 404 });
    }
    const interviewId = interviewRes.rows[0].id;

    // Check if already assigned
    const existing = await pool.query(
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

    // Get next order number
    const orderRes = await pool.query(
      `SELECT COALESCE(MAX(question_order), 0) + 1 AS next_order
       FROM interview_questions WHERE interview_id = $1`,
      [interviewId],
    );
    const nextOrder = orderRes.rows[0].next_order;

    // Assign question to interview
    await pool.query(
      `INSERT INTO interview_questions (interview_id, question_id, question_order)
       VALUES ($1, $2, $3)`,
      [interviewId, questionId, nextOrder],
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("POST /questions/available ERROR:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Lỗi máy chủ" },
      { status: 500 },
    );
  }
}
