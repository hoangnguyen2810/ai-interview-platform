// API Route: /api/interviews/[meetingCode]/submissions
//
// POST  → Candidate submits code. Runs it via sandbox and stores submission in DB.
//         Emits `submission:added` to recruiter via Socket.IO.
//         After successful submit, fire-and-forget triggers the AI code review.
// GET   → Recruiter fetches all submissions for the interview (ordered by time).
//
// Body (POST): { code, language, questionId? }

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/auth";

const SANDBOX_URL = process.env.SANDBOX_SERVICE_URL || "http://localhost:3002";
const SOCKET_URL = process.env.SOCKET_SERVER_URL || "http://localhost:3001";
const APP_BASE_URL =
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

const ALLOWED_LANGUAGES = ["python", "javascript", "java", "cpp"];

interface Params {
  params: Promise<{ meetingCode: string }>;
}

interface SandboxResult {
  success: boolean;
  stdout: string;
  stderr: string;
  runtimeMs: number;
  exitCode: number;
  error?: string;
}

interface ExecuteRequest {
  code: string;
  language: string;
  stdin?: string;
}

function mapSandboxStatus(result: SandboxResult): string {
  if (result.error?.includes("TIMEOUT")) return "TIMEOUT";
  if (result.exitCode === 0 && !result.stderr) return "SUCCESS";
  if (result.stderr?.includes("Error") || result.stderr?.includes("error")) {
    if (
      result.error?.includes("Compilation") ||
      result.stderr?.includes("compilation")
    ) {
      return "COMPILE_ERROR";
    }
    return "RUNTIME_ERROR";
  }
  return "SUCCESS";
}

// Maps a code_executions status → equivalent code_submissions status.
// The two tables have different status vocabularies:
//   code_executions : PENDING | RUNNING | SUCCESS | TIMEOUT | COMPILE_ERROR | RUNTIME_ERROR | SYSTEM_ERROR
//   code_submissions: PENDING | RUNNING | ACCEPTED | WRONG_ANSWER | COMPILE_ERROR | RUNTIME_ERROR | TIMEOUT | SYSTEM_ERROR
function toSubmissionStatus(execStatus: string): string {
  if (execStatus === "SUCCESS") return "ACCEPTED";
  return execStatus; // COMPILE_ERROR, RUNTIME_ERROR, TIMEOUT, SYSTEM_ERROR stay the same
}

// ─── POST — candidate submits code ─────────────────────────────────────────────

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
    const body: ExecuteRequest & { questionId?: string } = await req.json();

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json(
        { success: false, message: "Thiếu code" },
        { status: 400 },
      );
    }

    if (!body.language || !ALLOWED_LANGUAGES.includes(body.language)) {
      return NextResponse.json(
        {
          success: false,
          message: `Language không hợp lệ. Cho phép: ${ALLOWED_LANGUAGES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // 1. Find interview
    const interviewRes = await pool.query(
      `SELECT id FROM interviews WHERE meeting_code = $1 AND deleted_at IS NULL`,
      [meetingCode],
    );
    if (interviewRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Interview không tồn tại" },
        { status: 404 },
      );
    }
    const interviewId = interviewRes.rows[0].id;

    // 2. Find interview_candidate row for this user
    const candRes = await pool.query(
      `SELECT id FROM interview_candidates
       WHERE interview_id = $1 AND user_id = $2 LIMIT 1`,
      [interviewId, auth.id],
    );
    if (candRes.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Bạn không phải candidate của phỏng vấn này",
        },
        { status: 403 },
      );
    }
    const interviewCandidateId = candRes.rows[0].id;

    // 3. Determine questionId — prefer body, fallback to active question
    let questionId = body.questionId ?? null;
    if (!questionId) {
      const activeRes = await pool.query(
        `SELECT active_question_id FROM interviews WHERE id = $1`,
        [interviewId],
      );
      questionId = activeRes.rows[0]?.active_question_id ?? null;
    }
    if (!questionId) {
      return NextResponse.json(
        {
          success: false,
          message: "Chưa có câu hỏi active để submit",
        },
        { status: 400 },
      );
    }

    // 4. Insert code_executions row + code_submissions row (linked)
    // Create execution record first so it has an ID we can attach to the submission
    const execRes = await pool.query(
      `INSERT INTO code_executions
        (interview_id, question_id, language, source_code, stdin_data, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING id`,
      [interviewId, questionId, body.language, body.code, body.stdin || null],
    );
    const executionId: string = execRes.rows[0].id;

    const subRes = await pool.query(
      `INSERT INTO code_submissions
        (interview_id, interview_candidate_id, question_id, language, source_code, status, execution_id, candidate_name)
      VALUES ($1, $2, $3, $4, $5, 'PENDING', $6,
              (SELECT full_name FROM users WHERE id = $7))
      RETURNING id, created_at`,
      [
        interviewId,
        interviewCandidateId,
        questionId,
        body.language,
        body.code,
        executionId,
        auth.id,
      ],
    );
    const submissionId: string = subRes.rows[0].id;
    const createdAt: string = subRes.rows[0].created_at;

    // 5. Execute via sandbox
    let result: SandboxResult;
    let status: string;

    try {
      await pool.query(
        `UPDATE code_submissions SET status = 'RUNNING' WHERE id = $1::uuid`,
        [submissionId],
      );
      await pool.query(
        `UPDATE code_executions SET status = 'RUNNING' WHERE id = $1::uuid`,
        [executionId],
      );

      const sandboxRes = await fetch(`${SANDBOX_URL}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: body.code,
          language: body.language,
          stdin: body.stdin || "",
          // Pass existing execution id so sandbox route UPDATEs instead of
          // INSERTing a second code_executions row.
          executionId,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!sandboxRes.ok) {
        throw new Error(`Sandbox returned ${sandboxRes.status}`);
      }

      result = await sandboxRes.json();
      status = mapSandboxStatus(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await pool.query(
        `UPDATE code_submissions
         SET status = 'SYSTEM_ERROR',
             runtime_ms = 0
         WHERE id = $1::uuid`,
        [submissionId],
      );
      await pool.query(
        `UPDATE code_executions
         SET status = 'SYSTEM_ERROR',
             stderr = $1,
             completed_at = CURRENT_TIMESTAMP
         WHERE id = $2::uuid`,
        [errorMessage, executionId],
      );

      // Build a "submission added" payload even on sandbox failure so recruiter sees it
      const failPayload = {
        submissionId,
        questionId,
        language: body.language,
        sourceCode: body.code,
        stdout: "",
        stderr: errorMessage,
        runtimeMs: 0,
        exitCode: -1,
        status: "SYSTEM_ERROR",
        success: false,
        createdAt,
        candidateId: interviewCandidateId,
        candidateName: null as string | null,
      };

      // Try to fetch candidate name (best-effort)
      try {
        const u = await pool.query(
          `SELECT full_name FROM users WHERE id = $1`,
          [auth.id],
        );
        failPayload.candidateName = u.rows[0]?.full_name ?? null;
      } catch {
        /* ignore */
      }

      fetch(`${SOCKET_URL}/emit/submission-added`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingCode, submission: failPayload }),
      }).catch((err) =>
        console.warn("[Socket.IO] Emit submission:added failed:", err),
      );

      return NextResponse.json(
        {
          success: false,
          message: "Sandbox service unavailable",
          submissionId,
        },
        { status: 503 },
      );
    }

    // 6. Persist execution results
    const submissionStatus = toSubmissionStatus(status);
    await pool.query(
      `UPDATE code_submissions
       SET status = $1,
           runtime_ms = $2
       WHERE id = $3::uuid`,
      [submissionStatus, result.runtimeMs, submissionId],
    );
    await pool.query(
      `UPDATE code_executions
       SET status = $1,
           stdout = $2,
           stderr = $3,
           exit_code = $4,
           runtime_ms = $5,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $6::uuid`,
      [
        status,
        result.stdout || "",
        result.stderr || "",
        result.exitCode,
        result.runtimeMs,
        executionId,
      ],
    );

    // 7. Fetch candidate name (best-effort)
    let candidateName: string | null = null;
    try {
      const u = await pool.query(`SELECT full_name FROM users WHERE id = $1`, [
        auth.id,
      ]);
      candidateName = u.rows[0]?.full_name ?? null;
    } catch {
      /* ignore */
    }

    // 8. Emit to recruiter via Socket.IO
    const submissionPayload = {
      submissionId,
      questionId,
      language: body.language,
      sourceCode: body.code,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      runtimeMs: result.runtimeMs,
      exitCode: result.exitCode,
      status: submissionStatus,
      success: result.success,
      createdAt,
      candidateId: interviewCandidateId,
      candidateName,
    };

    fetch(`${SOCKET_URL}/emit/submission-added`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingCode, submission: submissionPayload }),
    }).catch((err) =>
      console.warn("[Socket.IO] Emit submission:added failed:", err),
    );

    // Fire-and-forget AI code review. Failure here must never break the submit
    // response, so we do not await it.
    fetch(
      `${APP_BASE_URL}/api/interviews/${encodeURIComponent(
        meetingCode,
      )}/code-review`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: req.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({ submissionId }),
      },
    ).catch((err) => console.warn("[code-review] Auto-trigger failed:", err));

    return NextResponse.json(
      {
        success: true,
        message: "Đã nộp code",
        submission: submissionPayload,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /submissions ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}

// ─── GET — recruiter fetches all submissions ───────────────────────────────────

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

    const interviewRes = await pool.query(
      `SELECT id FROM interviews WHERE meeting_code = $1 LIMIT 1`,
      [meetingCode],
    );
    if (interviewRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Interview không tồn tại" },
        { status: 404 },
      );
    }
    const interviewId = interviewRes.rows[0].id;

    const subRes = await pool.query(
      `SELECT
         s.id              AS submission_id,
         s.question_id,
         s.language,
         s.source_code,
         s.status,
         s.runtime_ms,
         s.created_at,
         -- Prefer the snapshot taken at submit time (see migration 017).
         -- Fallback to the joined candidate name for legacy rows that
         -- pre-date the snapshot column.
         COALESCE(NULLIF(s.candidate_name, ''), ic.candidate_name)
                          AS candidate_name,
         ic.user_id        AS candidate_user_id,
         ce.stdout         AS stdout,
         ce.stderr         AS stderr,
         ce.exit_code      AS exit_code
       FROM code_submissions s
       JOIN interview_candidates ic ON ic.id = s.interview_candidate_id
       LEFT JOIN code_executions ce ON ce.id = s.execution_id
       WHERE s.interview_id = $1
       ORDER BY s.created_at ASC`,
      [interviewId],
    );

    const submissions = subRes.rows.map((r) => ({
      submissionId: r.submission_id,
      questionId: r.question_id,
      language: r.language,
      sourceCode: r.source_code,
      status: r.status,
      runtimeMs: r.runtime_ms,
      stdout: r.stdout ?? "",
      stderr: r.stderr ?? "",
      exitCode: r.exit_code ?? null,
      createdAt: r.created_at,
      candidateName: r.candidate_name,
      candidateUserId: r.candidate_user_id,
    }));

    return NextResponse.json({ success: true, submissions });
  } catch (error) {
    console.error("GET /submissions ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi máy chủ" },
      { status: 500 },
    );
  }
}
