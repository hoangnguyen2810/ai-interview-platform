// API Route: POST /api/sandbox/execute
// Executes code in Docker sandbox and returns results

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

const SANDBOX_URL = process.env.SANDBOX_SERVICE_URL || "http://localhost:3002";

const ALLOWED_LANGUAGES = ["python", "javascript", "java", "cpp"];

interface ExecuteRequest {
  code: string;
  language: string;
  stdin?: string;
  meetingCode: string;
  questionId?: string;
  /**
   * Optional pre-existing execution row id. When provided, the route UPDATEs
   * that row instead of INSERTing a new one — prevents duplicate execution
   * records when called from /api/interviews/[meetingCode]/submissions.
   */
  executionId?: string;
}

interface SandboxResult {
  success: boolean;
  stdout: string;
  stderr: string;
  runtimeMs: number;
  exitCode: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExecuteRequest = await request.json();

    // Validate required fields
    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'code' field" },
        { status: 400 }
      );
    }

    if (!body.language || !ALLOWED_LANGUAGES.includes(body.language)) {
      return NextResponse.json(
        { error: `Invalid language. Allowed: ${ALLOWED_LANGUAGES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!body.meetingCode || typeof body.meetingCode !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'meetingCode'" },
        { status: 400 }
      );
    }

    // Get interview ID from meeting code
    const interviewResult = await pool.query(
      `SELECT id FROM interviews WHERE meeting_code = $1 AND deleted_at IS NULL`,
      [body.meetingCode]
    );

    if (interviewResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    const interviewId = interviewResult.rows[0].id;

    let executionId: string;
    if (body.executionId) {
      // Caller already created the execution row (e.g. submissions route).
      // Mark it RUNNING and reuse it for the result UPDATE.
      executionId = body.executionId;
      await pool.query(
        `UPDATE code_executions SET status = 'RUNNING' WHERE id = $1::uuid`,
        [executionId]
      );
    } else {
      // Standalone usage — caller didn't pre-create a row, so we create one.
      const execResult = await pool.query(
        `INSERT INTO code_executions
          (interview_id, question_id, language, source_code, stdin_data, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')
         RETURNING id`,
        [
          interviewId,
          body.questionId || null,
          body.language,
          body.code,
          body.stdin || null,
        ]
      );
      executionId = execResult.rows[0].id;
    }

    // Execute code in sandbox
    let result: SandboxResult;

    try {
      // If we created the row above, transition to RUNNING here.
      if (!body.executionId) {
        await pool.query(
          `UPDATE code_executions SET status = 'RUNNING' WHERE id = $1::uuid`,
          [executionId]
        );
      }

      const sandboxResponse = await fetch(`${SANDBOX_URL}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: body.code,
          language: body.language,
          stdin: body.stdin || "",
        }),
        signal: AbortSignal.timeout(15000), // 15s timeout for the whole request
      });

      if (!sandboxResponse.ok) {
        throw new Error(`Sandbox returned ${sandboxResponse.status}`);
      }

      result = await sandboxResponse.json();
    } catch (error) {
      // Sandbox service unavailable - mark as system error
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      await pool.query(
        `UPDATE code_executions
         SET status = 'SYSTEM_ERROR',
             stderr = $1,
             completed_at = CURRENT_TIMESTAMP
         WHERE id = $2::uuid`,
        [errorMessage, executionId]
      );

      return NextResponse.json(
        {
          error: "Sandbox service unavailable",
          details: errorMessage,
          executionId,
        },
        { status: 503 }
      );
    }

    // Map sandbox result to execution status
    let status: string;
    if (result.error?.includes("TIMEOUT")) {
      status = "TIMEOUT";
    } else if (result.exitCode === 0 && !result.stderr) {
      status = "SUCCESS";
    } else if (result.stderr?.includes("Error") || result.stderr?.includes("error")) {
      if (result.error?.includes("Compilation") || result.stderr?.includes("compilation")) {
        status = "COMPILE_ERROR";
      } else {
        status = "RUNTIME_ERROR";
      }
    } else {
      status = "SUCCESS";
    }

    // Update execution record with results
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
      ]
    );

    return NextResponse.json({
      executionId,
      status,
      stdout: result.stdout,
      stderr: result.stderr,
      runtimeMs: result.runtimeMs,
      exitCode: result.exitCode,
      success: result.success,
    });
  } catch (error) {
    console.error("[Sandbox API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
