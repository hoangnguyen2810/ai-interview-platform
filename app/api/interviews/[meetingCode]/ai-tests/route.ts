// API Route: /api/interviews/[meetingCode]/ai-tests
//
// Recruiter-facing endpoints to manage AI-generated test cases for a
// submission. Authorisation: RECRUITER or ADMIN only.
//
//   POST   action=run    { testIds: string[] }   → run selected tests via sandbox
//   POST   action=add    { inputData, expectedOutput?, description?, edgeCaseType? }
//                                                  → create a new manual test
//   PATCH                { id, ...fields }       → edit one test row
//   DELETE               { id }                  → delete one test row
//
// Each handler validates that the target row belongs to a submission in the
// meeting's interview before mutating, to prevent cross-interview access.

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest, forbidden } from "@/lib/auth";

const SANDBOX_URL = process.env.SANDBOX_SERVICE_URL || "http://localhost:3002";

export const runtime = "nodejs";

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

interface TestCaseRow {
  id: string;
  submission_id: string;
  input_data: string;
  expected_output: string | null;
  description: string | null;
  edge_case_type: string | null;
  status: string;
  actual_output: string | null;
  stderr: string | null;
  runtime_ms: number | null;
  execution_order: number;
  source: string;
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function badRequest(message: string) {
  return NextResponse.json({ success: false, message }, { status: 400 });
}

function ensureRecruiter(auth: ReturnType<typeof getAuthUserFromRequest>) {
  if (!auth) {
    return NextResponse.json(
      { success: false, message: "Chưa đăng nhập" },
      { status: 401 },
    );
  }
  if (auth.role !== "RECRUITER" && auth.role !== "ADMIN") {
    return forbidden("Chỉ recruiter mới có quyền thao tác test case");
  }
  return null;
}

/** Resolve submission → interview for the given meeting. Returns submission + source code + language. */
async function loadSubmissionContext(
  meetingCode: string,
  submissionId: string,
): Promise<
  | {
      submissionId: string;
      sourceCode: string;
      language: string;
    }
  | { error: NextResponse }
> {
  if (!UUID_RE.test(submissionId)) {
    return { error: badRequest("submissionId không hợp lệ (phải là UUID)") };
  }
  const res = await pool.query(
    `SELECT s.id          AS submission_id,
            s.source_code,
            s.language,
            s.interview_id
     FROM code_submissions s
     WHERE s.id = $1::uuid
       AND s.interview_id = (SELECT id FROM interviews WHERE meeting_code = $2)
     LIMIT 1`,
    [submissionId, meetingCode],
  );
  if (res.rows.length === 0) {
    return {
      error: NextResponse.json(
        { success: false, message: "Submission không tồn tại trong meeting này" },
        { status: 404 },
      ),
    };
  }
  return {
    submissionId: res.rows[0].submission_id,
    sourceCode: res.rows[0].source_code,
    language: res.rows[0].language,
  };
}

async function runInSandbox(
  code: string,
  language: string,
  stdin: string,
  timeoutMs = 10000,
): Promise<SandboxResult> {
  const res = await fetch(`${SANDBOX_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language, stdin }),
    signal: AbortSignal.timeout(timeoutMs + 2500),
  });
  const json = (await res.json().catch(() => null)) as SandboxResult | null;
  if (!res.ok || !json) {
    return {
      success: false,
      stdout: "",
      stderr: json?.error ?? `Sandbox ${res.status}`,
      runtimeMs: 0,
      exitCode: -1,
      error: json?.error ?? "sandbox unreachable",
    };
  }
  return json;
}

function evaluateTest(
  sandboxRun: SandboxResult,
  expected: string | null,
): {
  status: "PASSED" | "FAILED" | "RUNTIME_ERROR" | "TIMEOUT";
  actual: string;
} {
  const actual = sandboxRun.stdout ?? "";
  let status: "PASSED" | "FAILED" | "RUNTIME_ERROR" | "TIMEOUT" = "FAILED";
  if (sandboxRun.exitCode === -1 && sandboxRun.error?.includes("TIMEOUT")) {
    status = "TIMEOUT";
  } else if (
    sandboxRun.exitCode !== 0 ||
    (sandboxRun.stderr && sandboxRun.stderr.trim().length > 0)
  ) {
    status = "RUNTIME_ERROR";
  } else if (actual.trim() === (expected ?? "").trim()) {
    status = "PASSED";
  }
  return { status, actual };
}

async function loadTestRow(
  testId: string,
  submissionId: string,
): Promise<TestCaseRow | null> {
  if (!UUID_RE.test(testId)) return null;
  const res = await pool.query(
    `SELECT id, submission_id, input_data, expected_output, description,
            edge_case_type, status, actual_output, stderr, runtime_ms,
            execution_order, source
     FROM ai_generated_test_cases
     WHERE id = $1::uuid AND submission_id = $2::uuid
     LIMIT 1`,
    [testId, submissionId],
  );
  return (res.rows[0] as TestCaseRow | undefined) ?? null;
}

// ─── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, ctx: Params) {
  const auth = getAuthUserFromRequest(req);
  const guardErr = ensureRecruiter(auth);
  if (guardErr) return guardErr;

  const { meetingCode } = await ctx.params;
  const body = (await req.json().catch(() => null)) as
    | {
        action?: string;
        submissionId?: string;
        testIds?: string[];
        inputData?: string;
        expectedOutput?: string;
        description?: string;
        edgeCaseType?: string;
      }
    | null;

  if (!body || typeof body.action !== "string") {
    return badRequest("Thiếu action");
  }
  if (!body.submissionId) {
    return badRequest("Thiếu submissionId");
  }
  const ctx2 = await loadSubmissionContext(meetingCode, body.submissionId);
  if ("error" in ctx2) return ctx2.error;

  if (body.action === "run") {
    return handleRun(ctx2.submissionId, ctx2.sourceCode, ctx2.language, body.testIds ?? []);
  }
  if (body.action === "add") {
    return handleAdd(
      ctx2.submissionId,
      body.inputData,
      body.expectedOutput,
      body.description,
      body.edgeCaseType,
    );
  }
  return badRequest(`action không hợp lệ: ${body.action}`);
}

async function handleRun(
  submissionId: string,
  sourceCode: string,
  language: string,
  testIds: string[],
) {
  if (!Array.isArray(testIds) || testIds.length === 0) {
    return badRequest("Thiếu testIds (mảng UUID)");
  }
  if (testIds.some((id) => !UUID_RE.test(id))) {
    return badRequest("testIds chứa phần tử không phải UUID");
  }

  const results: unknown[] = [];
  for (const testId of testIds) {
    const row = await loadTestRow(testId, submissionId);
    if (!row) {
      results.push({ id: testId, error: "not_found" });
      continue;
    }
    const sandboxRun = await runInSandbox(sourceCode, language, row.input_data);
    const { status, actual } = evaluateTest(sandboxRun, row.expected_output);

    await pool.query(
      `UPDATE ai_generated_test_cases
       SET status = $1,
           actual_output = $2,
           stderr = $3,
           runtime_ms = $4,
           ai_verified = $5
       WHERE id = $6::uuid`,
      [
        status,
        actual,
        sandboxRun.stderr ?? "",
        sandboxRun.runtimeMs ?? 0,
        status === "PASSED",
        row.id,
      ],
    );
    results.push({
      id: row.id,
      status,
      actualOutput: actual,
      stderr: sandboxRun.stderr ?? "",
      runtimeMs: sandboxRun.runtimeMs ?? 0,
    });
  }

  return NextResponse.json({ success: true, results });
}

async function handleAdd(
  submissionId: string,
  inputData: string | undefined,
  expectedOutput: string | undefined,
  description: string | undefined,
  edgeCaseType: string | undefined,
) {
  if (typeof inputData !== "string") {
    return badRequest("Thiếu inputData");
  }

  // Append at the end of execution_order.
  const orderRes = await pool.query(
    `SELECT COALESCE(MAX(execution_order), -1) + 1 AS next_order
     FROM ai_generated_test_cases WHERE submission_id = $1::uuid`,
    [submissionId],
  );
  const nextOrder = orderRes.rows[0]?.next_order ?? 0;

  let ins;
  try {
    ins = await pool.query(
      `INSERT INTO ai_generated_test_cases
         (submission_id, input_data, expected_output, description, edge_case_type, execution_order, status, source)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, 'PENDING', 'MANUAL')
       RETURNING id, submission_id, input_data, expected_output, description,
                 edge_case_type, status, actual_output, stderr, runtime_ms,
                 execution_order, source`,
      [
        submissionId,
        inputData,
        expectedOutput ?? null,
        description ?? null,
        edgeCaseType ?? null,
        nextOrder,
      ],
    );
  } catch (e) {
    console.error("[ai-tests add] DB error:", e);
    return NextResponse.json(
      {
        success: false,
        message: `Lỗi DB khi thêm test case: ${
          e instanceof Error ? e.message : String(e)
        }`,
      },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true, test: ins.rows[0] });
}

// ─── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, ctx: Params) {
  const auth = getAuthUserFromRequest(req);
  const guardErr = ensureRecruiter(auth);
  if (guardErr) return guardErr;

  const { meetingCode } = await ctx.params;
  const body = (await req.json().catch(() => null)) as
    | {
        id?: string;
        submissionId?: string;
        inputData?: string;
        expectedOutput?: string | null;
        description?: string | null;
        edgeCaseType?: string | null;
      }
    | null;

  if (!body?.id) return badRequest("Thiếu id");
  if (!body.submissionId) return badRequest("Thiếu submissionId");
  if (!UUID_RE.test(body.id)) return badRequest("id không phải UUID");

  const ctx2 = await loadSubmissionContext(meetingCode, body.submissionId);
  if ("error" in ctx2) return ctx2.error;

  const existing = await loadTestRow(body.id, ctx2.submissionId);
  if (!existing) {
    return NextResponse.json(
      { success: false, message: "Test case không tồn tại" },
      { status: 404 },
    );
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  const addParam = (col: string, value: unknown) => {
    params.push(value);
    updates.push(`${col} = $${params.length}`);
  };
  const addLiteral = (snippet: string) => {
    updates.push(snippet);
  };

  let resetVerified = false;
  if (typeof body.inputData === "string") {
    addParam("input_data", body.inputData);
    resetVerified = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "expectedOutput") &&
      body.expectedOutput !== undefined) {
    addParam("expected_output", body.expectedOutput);
    resetVerified = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "description") &&
      body.description !== undefined)
    addParam("description", body.description);
  if (Object.prototype.hasOwnProperty.call(body, "edgeCaseType") &&
      body.edgeCaseType !== undefined)
    addParam("edge_case_type", body.edgeCaseType);

  if (updates.length === 0) {
    return badRequest("Không có trường nào để cập nhật");
  }

  // Reset status to PENDING after edit so the recruiter can re-run.
  addLiteral("status = 'PENDING'");
  addLiteral("actual_output = NULL");
  addLiteral("stderr = NULL");
  addLiteral("runtime_ms = NULL");
  // Editing input/expected invalidates the AI self-verification: the test no
  // longer matches what the AI originally produced, so the next sandbox run
  // is the first verification of the edited pair.
  if (resetVerified) addLiteral("ai_verified = FALSE");

  addParam("id", body.id);  // uses $N placeholder
  const finalSql = `UPDATE ai_generated_test_cases SET ${updates.join(", ")}
   WHERE id = $${params.length}::uuid
   RETURNING id, submission_id, input_data, expected_output, description,
             edge_case_type, status, actual_output, stderr, runtime_ms,
             execution_order, source, ai_verified`;
  console.log("[ai-tests PATCH] finalSql:", finalSql);
  console.log("[ai-tests PATCH] params:", JSON.stringify(params));
  try {
    const upd = await pool.query(finalSql, params);
    return NextResponse.json({ success: true, test: upd.rows[0] });
  } catch (e) {
    console.error("[ai-tests PATCH] DB error:", e);
    return NextResponse.json(
      {
        success: false,
        message: `Lỗi DB khi cập nhật test case: ${
          e instanceof Error ? e.message : String(e)
        }`,
      },
      { status: 500 },
    );
  }
}

// ─── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, ctx: Params) {
  const auth = getAuthUserFromRequest(req);
  const guardErr = ensureRecruiter(auth);
  if (guardErr) return guardErr;

  const { meetingCode } = await ctx.params;
  const url = new URL(req.url);
  const testId = url.searchParams.get("id");
  const submissionId = url.searchParams.get("submissionId");
  if (!testId) return badRequest("Thiếu id");
  if (!submissionId) return badRequest("Thiếu submissionId");
  if (!UUID_RE.test(testId)) return badRequest("id không phải UUID");

  const ctx2 = await loadSubmissionContext(meetingCode, submissionId);
  if ("error" in ctx2) return ctx2.error;

  const res = await pool.query(
    `DELETE FROM ai_generated_test_cases
     WHERE id = $1::uuid AND submission_id = $2::uuid`,
    [testId, ctx2.submissionId],
  );
  if (res.rowCount === 0) {
    return NextResponse.json(
      { success: false, message: "Test case không tồn tại" },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true });
}