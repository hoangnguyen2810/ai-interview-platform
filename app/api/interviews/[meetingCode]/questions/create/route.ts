// POST /api/interviews/[meetingCode]/questions/create
// Recruiter creates a new coding question and optionally assigns it to the interview

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
    const { title, description, difficulty, assignToInterview } = body ?? {};

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json(
        { success: false, message: "Tiêu đề và mô tả không được để trống" },
        { status: 400 },
      );
    }

    if (difficulty && !["EASY", "MEDIUM", "HARD"].includes(difficulty)) {
      return NextResponse.json(
        { success: false, message: "Difficulty phải là EASY, MEDIUM hoặc HARD" },
        { status: 400 },
      );
    }

    // Create the question
    const qRes = await pool.query(
      `INSERT INTO coding_questions (title, description, difficulty, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, description, difficulty`,
      [title.trim(), description.trim(), difficulty ?? null, auth.id],
    );
    const question = qRes.rows[0];

    // Assign to this interview if requested
    if (assignToInterview) {
      const interviewRes = await pool.query(
        `SELECT id FROM interviews WHERE meeting_code = $1`,
        [meetingCode],
      );
      if (interviewRes.rows[0]) {
        const orderRes = await pool.query(
          `SELECT COALESCE(MAX(question_order), 0) + 1 AS next_order
           FROM interview_questions WHERE interview_id = $1`,
          [interviewRes.rows[0].id],
        );
        await pool.query(
          `INSERT INTO interview_questions (interview_id, question_id, question_order)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [interviewRes.rows[0].id, question.id, orderRes.rows[0].next_order],
        );
      }
    }

    // Emit to Socket.IO server → notifies all candidates in the room in real-time
    const socketUrl = process.env.SOCKET_SERVER_URL || "http://localhost:3001";
    fetch(`${socketUrl}/emit/question-added`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingCode, question }),
    }).catch((err) => console.warn(`[Socket.IO] Emit failed (non-critical):`, err));

    return NextResponse.json({ success: true, question }, { status: 201 });
  } catch (error) {
    console.error("POST /questions/create ERROR:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Lỗi máy chủ" },
      { status: 500 },
    );
  }
}
