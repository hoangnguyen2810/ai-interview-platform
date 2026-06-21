// POST /api/interviews/[meetingCode]/messages
// Gửi một tin nhắn chat trong buổi phỏng vấn.
// Body: { content: string }
// Trả về tin nhắn đã tạo (để client append vào list).

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
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập" },
        { status: 401 },
      );
    }

    const { meetingCode } = await ctx.params;

    // Verify meeting exists and user is a participant
    const interviewRes = await pool.query(
      `SELECT id FROM interviews WHERE meeting_code = $1 LIMIT 1`,
      [meetingCode],
    );
    if (!interviewRes.rows[0]) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.content !== "string" || !body.content.trim()) {
      return NextResponse.json(
        { success: false, message: "Nội dung tin nhắn không hợp lệ" },
        { status: 400 },
      );
    }

    const content = body.content.trim();

    // Get sender name
    let senderName = auth.id; // fallback
    try {
      const userRes = await pool.query<{ full_name: string }>(
        `SELECT full_name FROM users WHERE id = $1 LIMIT 1`,
        [auth.id],
      );
      senderName = userRes.rows[0]?.full_name ?? senderName;
    } catch {
      // ignore
    }

    const result = await pool.query<{
      id: string;
      sender_id: string;
      sender_name: string;
      content: string;
      type: string;
      created_at: Date;
    }>(
      `INSERT INTO messages (meeting_code, sender_id, sender_name, content, type, session_id)
       VALUES ($1, $2, $3, $4, 'TEXT', NULL)
       RETURNING id, sender_id, sender_name, content, type, created_at`,
      [meetingCode, auth.id, senderName, content],
    );

    const row = result.rows[0];

    return NextResponse.json(
      {
        success: true,
        message: {
          id: row.id,
          senderId: row.sender_id,
          senderName: row.sender_name,
          content: row.content,
          type: row.type,
          createdAt: row.created_at.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /messages ERROR:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Lỗi máy chủ" },
      { status: 500 },
    );
  }
}
