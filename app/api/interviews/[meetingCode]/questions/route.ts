// GET  /api/interviews/[meetingCode]/questions  — list questions assigned to interview
// POST /api/interviews/[meetingCode]/questions  — set active question (recruiter only)
// Body (POST): { questionId: string }

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ meetingCode: string }>;
}

// GET — list all questions assigned to the interview + active flag
export async function GET(req: Request, ctx: Params) {
  try {
    const { meetingCode } = await ctx.params;

    const res = await pool.query(
      `SELECT
         q.id,
         q.title,
         q.description,
         q.difficulty,
         iq.question_order
       FROM interview_questions iq
       JOIN coding_questions q ON q.id = iq.question_id
       JOIN interviews i ON i.id = iq.interview_id
       WHERE i.meeting_code = $1
       ORDER BY iq.question_order ASC`,
      [meetingCode],
    );

    // Also fetch active question id from interviews table
    const activeRes = await pool.query(
      `SELECT active_question_id FROM interviews WHERE meeting_code = $1`,
      [meetingCode],
    );
    const activeQuestionId = activeRes.rows[0]?.active_question_id ?? null;

    return NextResponse.json({
      questions: res.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        difficulty: row.difficulty,
        order: row.question_order,
        isActive: row.id === activeQuestionId,
      })),
      activeQuestionId,
    });
  } catch (error) {
    console.error("GET /questions ERROR:", error);
    return NextResponse.json({ success: false, message: "Lỗi máy chủ" }, { status: 500 });
  }
}

// POST — recruiter sets which question is currently active
export async function POST(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ success: false, message: "Chưa đăng nhập" }, { status: 401 });
    }

    const { meetingCode } = await ctx.params;

    // Only RECRUITER or ADMIN can set questions
    if (auth.role !== "RECRUITER" && auth.role !== "ADMIN") {
      return NextResponse.json({ success: false, message: "Không có quyền" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const questionId: string | undefined = body?.questionId;

    if (!questionId) {
      return NextResponse.json({ success: false, message: "Thiếu questionId" }, { status: 400 });
    }

    // Verify question belongs to this interview
    const iqRes = await pool.query(
      `SELECT iq.id FROM interview_questions iq
       JOIN interviews i ON i.id = iq.interview_id
       WHERE i.meeting_code = $1 AND iq.question_id = $2`,
      [meetingCode, questionId],
    );

    // If questionId is "custom", it's a one-off question sent via event body
    if (iqRes.rows.length === 0 && questionId !== "custom") {
      return NextResponse.json(
        { success: false, message: "Câu hỏi không thuộc phỏng vấn này" },
        { status: 404 },
      );
    }

    // Update active question
    await pool.query(
      `UPDATE interviews SET active_question_id = $1 WHERE meeting_code = $2`,
      [questionId === "custom" ? null : questionId, meetingCode],
    );

    // Fetch full question details to return
    let question = null;
    if (questionId !== "custom") {
      const qRes = await pool.query(
        `SELECT id, title, description, difficulty FROM coding_questions WHERE id = $1`,
        [questionId],
      );
      question = qRes.rows[0] ?? null;
    }

    return NextResponse.json({ success: true, question }, { status: 200 });
  } catch (error) {
    console.error("POST /questions ERROR:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Lỗi máy chủ" },
      { status: 500 },
    );
  }
}
