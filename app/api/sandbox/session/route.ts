// API Route: POST /api/sandbox/session
// Tạo phiên live coding tương tác — trả sessionId + wsUrl để FE connect WebSocket
// trực tiếp tới sandbox service (Next.js API Routes không proxy được WebSocket).

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { randomUUID } from "crypto";
import { getAuthUserFromRequest } from "@/lib/auth";

const ALLOWED_LANGUAGES = ["python", "javascript", "java", "cpp"];
const SANDBOX_WS_URL =
  process.env.NEXT_PUBLIC_SANDBOX_WS_URL || "ws://localhost:3002";

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUserFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'code' field" },
        { status: 400 },
      );
    }

    if (!body.language || !ALLOWED_LANGUAGES.includes(body.language)) {
      return NextResponse.json(
        { error: `Invalid language. Allowed: ${ALLOWED_LANGUAGES.join(", ")}` },
        { status: 400 },
      );
    }

    if (!body.meetingCode || typeof body.meetingCode !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'meetingCode'" },
        { status: 400 },
      );
    }

    const interviewResult = await pool.query(
      `SELECT id FROM interviews WHERE meeting_code = $1 AND deleted_at IS NULL`,
      [body.meetingCode],
    );

    if (interviewResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 },
      );
    }

    const interviewId = interviewResult.rows[0].id;
    const sessionId = randomUUID();

    await pool.query(
      `INSERT INTO code_executions
        (id, interview_id, question_id, language, source_code, status)
       VALUES ($1::uuid, $2, $3, $4, $5, 'RUNNING')`,
      [
        sessionId,
        interviewId,
        body.questionId || null,
        body.language,
        body.code,
      ],
    );

    return NextResponse.json({
      sessionId,
      wsUrl: `${SANDBOX_WS_URL}/ws/execute`,
    });
  } catch (error) {
    console.error("[Sandbox Session API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
