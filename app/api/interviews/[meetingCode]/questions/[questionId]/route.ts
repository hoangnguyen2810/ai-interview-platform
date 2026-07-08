// DELETE /api/interviews/[meetingCode]/questions/[questionId]
//   Recruiter gỡ câu hỏi khỏi buổi phỏng vấn hiện tại.
//   CHỈ xoá row trong `interview_questions`; KHÔNG xoá row trong
//   `coding_questions` để câu hỏi vẫn còn trong thư viện.
//
// PATCH /api/interviews/[meetingCode]/questions/[questionId]
//   Sửa nội dung câu hỏi (title/description/difficulty).
//   Vì câu hỏi được share giữa các interview (qua `interview_questions`),
//   bản chất là UPDATE row `coding_questions` — chỉ người tạo
//   (`created_by = auth.id`) hoặc ADMIN mới có quyền.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ meetingCode: string; questionId: string }>;
}

const SOCKET_URL = process.env.SOCKET_SERVER_URL || "http://localhost:3001";

// ─── shared: load interview_id + auth check + ownership ──────────────────────

async function loadContext(
  req: Request,
  params: Params["params"],
): Promise<
  | { ok: true; interviewId: string; auth: { id: string; role: string } }
  | { ok: false; response: NextResponse }
> {
  const auth = getAuthUserFromRequest(req);
  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Chưa đăng nhập" },
        { status: 401 },
      ),
    };
  }
  if (auth.role !== "RECRUITER" && auth.role !== "ADMIN") {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Không có quyền" },
        { status: 403 },
      ),
    };
  }

  const { meetingCode } = await params;

  const interviewRes = await pool.query<{ id: string }>(
    `SELECT id FROM interviews WHERE meeting_code = $1`,
    [meetingCode],
  );
  const interview = interviewRes.rows[0];
  if (!interview) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Phỏng vấn không tồn tại" },
        { status: 404 },
      ),
    };
  }

  return { ok: true, interviewId: interview.id, auth };
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(req: Request, ctx: Params) {
  try {
    const loaded = await loadContext(req, ctx.params);
    if (!loaded.ok) return loaded.response;

    const { questionId } = await ctx.params;
    const { interviewId, auth } = loaded;

    // 1) Verify question is currently assigned to this interview
    const iqRes = await pool.query(
      `SELECT id FROM interview_questions
       WHERE interview_id = $1 AND question_id = $2`,
      [interviewId, questionId],
    );

    if (iqRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Câu hỏi không thuộc buổi phỏng vấn này" },
        { status: 404 },
      );
    }

    // 2) Clear active_question_id if it points at this question
    await pool.query(
      `UPDATE interviews
       SET active_question_id = NULL
       WHERE id = $1 AND active_question_id = $2`,
      [interviewId, questionId],
    );

    // 3) Remove the mapping row
    await pool.query(
      `DELETE FROM interview_questions
       WHERE interview_id = $1 AND question_id = $2`,
      [interviewId, questionId],
    );

    // 4) Notify socket clients (candidate) để cập nhật UI real-time
    void fetch(`${SOCKET_URL}/emit/question-removed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingCode: (await ctx.params).meetingCode,
        questionId,
      }),
    }).catch((err) =>
      console.warn("[Socket.IO] Emit question-removed failed:", err),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /questions/[questionId] ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(req: Request, ctx: Params) {
  try {
    const loaded = await loadContext(req, ctx.params);
    if (!loaded.ok) return loaded.response;

    const { questionId } = await ctx.params;
    const { interviewId, auth } = loaded;

    const body = await req.json().catch(() => null);
    const { title, description, difficulty } = body ?? {};

    // Validate
    const updateFields: string[] = [];
    const updateValues: unknown[] = [];

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return NextResponse.json(
          { success: false, message: "Tiêu đề không được để trống" },
          { status: 400 },
        );
      }
      updateFields.push(`title = $${updateValues.length + 1}`);
      updateValues.push(title.trim());
    }

    if (description !== undefined) {
      if (typeof description !== "string" || !description.trim()) {
        return NextResponse.json(
          { success: false, message: "Mô tả không được để trống" },
          { status: 400 },
        );
      }
      updateFields.push(`description = $${updateValues.length + 1}`);
      updateValues.push(description.trim());
    }

    if (difficulty !== undefined && difficulty !== null) {
      if (!["EASY", "MEDIUM", "HARD"].includes(difficulty)) {
        return NextResponse.json(
          {
            success: false,
            message: "Difficulty phải là EASY, MEDIUM hoặc HARD",
          },
          { status: 400 },
        );
      }
      updateFields.push(`difficulty = $${updateValues.length + 1}`);
      updateValues.push(difficulty);
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, message: "Không có trường nào để cập nhật" },
        { status: 400 },
      );
    }

    // Check question exists + ownership
    const qRes = await pool.query<{ created_by: string | null }>(
      `SELECT created_by FROM coding_questions WHERE id = $1`,
      [questionId],
    );
    const question = qRes.rows[0];
    if (!question) {
      return NextResponse.json(
        { success: false, message: "Câu hỏi không tồn tại" },
        { status: 404 },
      );
    }

    // Permission: chỉ người tạo hoặc ADMIN mới được sửa
    if (auth.role !== "ADMIN" && question.created_by !== auth.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Chỉ người tạo câu hỏi hoặc Admin mới có quyền sửa",
        },
        { status: 403 },
      );
    }

    // Verify question is currently in this interview (để tránh sửa câu hỏi
    // không liên quan). Chỉ là cảnh báo; nếu câu hỏi đang được dùng ở
    // nhiều interview thì vẫn cho phép update (vì bản chất share).
    const iqCheck = await pool.query(
      `SELECT id FROM interview_questions
       WHERE interview_id = $1 AND question_id = $2`,
      [interviewId, questionId],
    );
    if (iqCheck.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Câu hỏi không thuộc buổi phỏng vấn này",
        },
        { status: 404 },
      );
    }

    // Perform update
    updateValues.push(questionId);
    const sql = `UPDATE coding_questions
                 SET ${updateFields.join(", ")}
                 WHERE id = $${updateValues.length}
                 RETURNING id, title, description, difficulty`;
    const updRes = await pool.query(sql, updateValues);
    const updated = updRes.rows[0];

    // Notify socket clients (candidate)
    void fetch(`${SOCKET_URL}/emit/question-updated`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingCode: (await ctx.params).meetingCode,
        question: updated,
      }),
    }).catch((err) =>
      console.warn("[Socket.IO] Emit question-updated failed:", err),
    );

    return NextResponse.json({ success: true, question: updated });
  } catch (error) {
    console.error("PATCH /questions/[questionId] ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}