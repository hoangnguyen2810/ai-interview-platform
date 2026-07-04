// API Route: /api/interviews/[meetingCode]/code-review
//
// POST → Trigger an AI review for a submission (qwen2.5-coder:3b).
//         Pipeline (refactored 2026-07-04):
//           1. Analyzer   → classifies executionMode (stdin / hardcoded / function / unknown)
//           2. Reviewer   → generates algorithm/score/hint verdict
//           3. Suggestion → proposes up to 3 edge test cases (always, for recruiter reference)
//           4. Auto-run   → ONLY when executionMode === "stdin" does the route run each
//                           suggested test via Docker sandbox. Otherwise the test cases
//                           are saved with status=PENDING for the recruiter to run manually.
//         The route persists everything in ai_reviews + ai_generated_test_cases and
//         emits `submission:reviewed` over Socket.IO.
//
// GET  → Return the persisted review (used by both candidate UI and recruiter).

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/auth";
import {
  analyzeExecutionMode,
  reviewCode,
  suggestTestCases,
} from "@/lib/ai-code-review";

const SANDBOX_URL = process.env.SANDBOX_SERVICE_URL || "http://localhost:3002";
const SOCKET_URL = process.env.SOCKET_SERVER_URL || "http://localhost:3001";

export const runtime = "nodejs";
// AI review can take ~30s (qwen2.5-coder:3b calls + N×sandbox runs).
export const maxDuration = 60;

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

interface AITestCaseRow {
  id: string;
  input_data: string;
  expected_output: string;
  description: string;
  edge_case_type: string;
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

// ─── POST — trigger review ────────────────────────────────────────────────────

export async function POST(req: Request, ctx: Params) {
  try {
    return await handlePostReview(req, ctx);
  } catch (e) {
    console.error("[code-review] UNHANDLED ERROR:", e);
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Lỗi máy chủ",
        detail: e instanceof Error ? e.stack : String(e),
      },
      { status: 500 },
    );
  }
}

async function handlePostReview(req: Request, ctx: Params) {
  const auth = getAuthUserFromRequest(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: "Chưa đăng nhập" },
      { status: 401 },
    );
  }

  const { meetingCode } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { submissionId?: string };
  const submissionId = body.submissionId;
  if (!submissionId) {
    return NextResponse.json(
      { success: false, message: "Thiếu submissionId" },
      { status: 400 },
    );
  }
  // UUID validation — fail fast with 400, avoid Postgres type errors.
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(submissionId)) {
    return NextResponse.json(
      { success: false, message: "submissionId không hợp lệ (phải là UUID)" },
      { status: 400 },
    );
  }

  // 1. Fetch submission + execution + question description.
  const subRes = await pool.query(
    `SELECT
       s.id              AS submission_id,
       s.interview_id,
       s.question_id,
       s.language,
       s.source_code,
       s.status          AS submission_status,
       q.title           AS question_title,
       q.description     AS question_description,
       ce.status         AS execution_status,
       ce.stdout         AS execution_stdout,
       ce.stderr         AS execution_stderr,
       ce.exit_code      AS execution_exit_code
     FROM code_submissions s
     JOIN coding_questions q ON q.id = s.question_id
     LEFT JOIN code_executions ce ON ce.id = s.execution_id
     WHERE s.id = $1::uuid AND s.interview_id = (
       SELECT id FROM interviews WHERE meeting_code = $2
     )
     LIMIT 1`,
    [submissionId, meetingCode],
  );

  if (subRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, message: "Submission không tồn tại" },
      { status: 404 },
    );
  }

  const row = subRes.rows[0];

  // 2. Upsert review row.
  const reviewRes = await pool.query(
    `INSERT INTO ai_reviews (submission_id, model_name)
     VALUES ($1::uuid, 'qwen2.5-coder:3b')
     ON CONFLICT (submission_id) DO UPDATE
       SET reviewed_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [submissionId],
  );
  const reviewId = reviewRes.rows[0].id as string;

  // 3. AI Analyzer — classify how the program accepts input.
  const modeAnalysis = await analyzeExecutionMode({
    problem: row.question_description,
    language: row.language,
    sourceCode: row.source_code,
  });
  const executionMode = modeAnalysis.executionMode; // "stdin" | "hardcoded" | "function" | "unknown"
  const canAutoRun = executionMode === "stdin";

  // 4. AI Reviewer — algorithm notes, complexity, hint, scores.
  //    For non-stdin modes the execution signal is unreliable / missing, so the
  //    reviewer is told to ground the verdict on source code only.
  let review;
  try {
    review = await reviewCode({
      problem: row.question_description,
      language: row.language,
      sourceCode: row.source_code,
      executionStatus: row.execution_status ?? "PENDING",
      stdout: row.execution_stdout ?? "",
      stderr: row.execution_stderr ?? "",
      exitCode: row.execution_exit_code,
      executionMode,
    });
  } catch (e) {
    console.error("[code-review] reviewCode failed:", e);
    review = {
      correctness: "PARTIAL" as const,
      algorithm: "AI review không khả dụng.",
      time_complexity: "unknown",
      space_complexity: "unknown",
      overall_score: 0,
      correctness_score: 0,
      algorithm_score: 0,
      strengths: "",
      weaknesses: String(e),
      hint: "",
    };
  }

  // 5. Generate AI-suggested edge test cases.
  //    Always produced so the recruiter has a starting point even when the
  //    program cannot be auto-run. Cap at 3 to keep review time bounded.
  let proposed: Awaited<ReturnType<typeof suggestTestCases>> = [];
  try {
    proposed = await suggestTestCases({
      problem: row.question_description,
      language: row.language,
      sourceCode: row.source_code,
      executionMode,
      count: 3,
    });
  } catch (e) {
    console.warn("[code-review] suggestTestCases failed:", e);
  }

  // 6. Persist analysis metadata + reviewer verdict into the review row.
  await pool.query(
    `UPDATE ai_reviews
     SET execution_mode = $1,
         analysis_confidence = $2,
         analysis_reason = $3,
         analysis_entry_point = $4,
         uses_hardcoded_values = $5,
         score = $6,
         overall_score = $6,
         correctness_score = $7,
         algorithm_score = $8,
         time_complexity = $9,
         space_complexity = $10,
         strengths = $11,
         weaknesses = $12,
         feedback = $13,
         hint = $14,
         reviewed_at = CURRENT_TIMESTAMP
     WHERE id = $15`,
    [
      executionMode,
      modeAnalysis.confidence,
      modeAnalysis.reason,
      modeAnalysis.entryPoint,
      modeAnalysis.usesHardcodedValues,
      // Stdin mode defers the final pass-rate-based score to the auto-run
      // block below; we still seed with the reviewer value so non-stdin
      // reviews land something sane immediately.
      review.overall_score,
      review.correctness_score,
      review.algorithm_score,
      review.time_complexity,
      review.space_complexity,
      review.strengths,
      review.weaknesses,
      review.algorithm,
      review.hint,
      reviewId,
    ],
  );

  // 7. Insert proposed tests with PENDING status.
  let inserted: AITestCaseRow[] = [];
  if (proposed.length > 0) {
    const tuples: string[] = [];
    const rowParams: unknown[] = [];
    proposed.forEach((t, i) => {
      const b = 1 + i * 6;
      tuples.push(
        `($1::uuid, $${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`,
      );
      rowParams.push(
        t.input,
        t.expected_output,
        t.description,
        t.edge_case_type,
        i,
        "PENDING",
      );
    });
    const ins = await pool.query(
      `INSERT INTO ai_generated_test_cases
         (submission_id, input_data, expected_output, description, edge_case_type, execution_order, status)
       VALUES ${tuples.join(", ")}
       RETURNING id, input_data, expected_output, description, edge_case_type`,
      [submissionId, ...rowParams],
    );
    inserted = ins.rows as AITestCaseRow[];
  }

  // 8. Auto-run sandbox ONLY when the analyzer confirms stdin mode.
  //    For other modes the tests stay PENDING so the recruiter can review / edit / run.
  let finalOverall = review.overall_score;
  let finalCorrectness = review.correctness_score;
  let finalCorrectnessLabel = review.correctness;

  if (canAutoRun && inserted.length > 0) {
    for (const t of inserted) {
      const sandboxRun = await runInSandbox(row.source_code, row.language, t.input_data);

      let status: "PASSED" | "FAILED" | "RUNTIME_ERROR" | "TIMEOUT" = "FAILED";
      const actual = sandboxRun.stdout ?? "";

      if (sandboxRun.exitCode === -1 && sandboxRun.error?.includes("TIMEOUT")) {
        status = "TIMEOUT";
      } else if (
        sandboxRun.exitCode !== 0 ||
        (sandboxRun.stderr && sandboxRun.stderr.trim().length > 0)
      ) {
        status = "RUNTIME_ERROR";
      } else if (actual.trim() === (t.expected_output ?? "").trim()) {
        status = "PASSED";
      }

      await pool.query(
        `UPDATE ai_generated_test_cases
         SET status = $1,
             actual_output = $2,
             stderr = $3,
             runtime_ms = $4,
             ai_verified = $5
         WHERE id = $6`,
        [
          status,
          actual,
          sandboxRun.stderr ?? "",
          sandboxRun.runtimeMs ?? 0,
          status === "PASSED",
          t.id,
        ],
      );
    }

    // Recompute final scores factoring in AI-generated test pass-rate.
    const passesRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'PASSED')::int AS passed,
         COUNT(*)::int AS total
       FROM ai_generated_test_cases WHERE submission_id = $1::uuid`,
      [submissionId],
    );
    const passed = passesRes.rows[0]?.passed ?? 0;
    const total = passesRes.rows[0]?.total ?? 0;
    if (total > 0) {
      const ratio = passed / total;
      finalCorrectness = Math.round(finalCorrectness * ratio * 100) / 100;
      finalOverall = Math.round(
        (finalCorrectness * 0.6 + review.algorithm_score * 0.4) * 100,
      ) / 100;
    }
    if (passed === total) finalCorrectnessLabel = "PASS";
    else if (passed === 0) finalCorrectnessLabel = "FAIL";
    else finalCorrectnessLabel = "PARTIAL";

    // 8b. Persist recomputed scores after auto-run.
    await pool.query(
      `UPDATE ai_reviews
       SET score = $1,
           overall_score = $1,
           correctness_score = $2
       WHERE id = $3`,
      [finalOverall, finalCorrectness, reviewId],
    );
  } else if (!canAutoRun) {
    // No auto-run possible — do not penalise the candidate. Keep the
    // reviewer's verdict if it picked CANNOT_RUN; otherwise nudge it toward
    // CANNOT_RUN so the UI surfaces the warning state.
    if (review.correctness !== "CANNOT_RUN") {
      finalCorrectnessLabel = "CANNOT_RUN";
    }
    await pool.query(
      `UPDATE ai_reviews
       SET score = $1,
           overall_score = $1,
           correctness_score = $2
       WHERE id = $3`,
      [finalOverall, finalCorrectness, reviewId],
    );
  }

  // 9. Build response payload.
  const testsRes = await pool.query(
    `SELECT id, input_data, expected_output, actual_output, status,
            description, edge_case_type, runtime_ms, source, ai_verified
     FROM ai_generated_test_cases
     WHERE submission_id = $1::uuid
     ORDER BY execution_order ASC`,
    [submissionId],
  );
  const passedCount = testsRes.rows.filter((t) => t.status === "PASSED").length;

  const payload = {
    success: true,
    review: {
      reviewId,
      overallScore: finalOverall,
      correctnessScore: finalCorrectness,
      algorithmScore: review.algorithm_score,
      timeComplexity: review.time_complexity,
      spaceComplexity: review.space_complexity,
      correctness: finalCorrectnessLabel,
      algorithm: review.algorithm,
      strengths: review.strengths,
      weaknesses: review.weaknesses,
      hint: review.hint,
      executionMode,
      analysisReason: modeAnalysis.reason,
      analysisConfidence: modeAnalysis.confidence,
      analysisEntryPoint: modeAnalysis.entryPoint,
      usesHardcodedValues: modeAnalysis.usesHardcodedValues,
      canAutoRun,
    },
    aiTests: {
      total: testsRes.rows.length,
      passed: passedCount,
      items: testsRes.rows.map((t) => ({
        id: t.id,
        description: t.description,
        edgeCaseType: t.edge_case_type,
        inputData: t.input_data,
        expectedOutput: t.expected_output,
        actualOutput: t.actual_output,
        status: t.status,
        runtimeMs: t.runtime_ms,
        source: t.source ?? "AI",
        aiVerified: t.ai_verified,
      })),
    },
  };

  // 10. Notify recruiter over Socket.IO (fire and forget).
  fetch(`${SOCKET_URL}/emit/submission-reviewed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meetingCode, submissionId, review: payload.review }),
  }).catch((err) =>
    console.warn("[Socket.IO] Emit submission:reviewed failed:", err),
  );

  return NextResponse.json(payload);
}

// ─── GET — fetch persisted review ─────────────────────────────────────────────

export async function GET(req: Request, ctx: Params) {
  const auth = getAuthUserFromRequest(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: "Chưa đăng nhập" },
      { status: 401 },
    );
  }

  const { meetingCode } = await ctx.params;
  const url = new URL(req.url);
  const submissionId = url.searchParams.get("submissionId");
  if (!submissionId) {
    return NextResponse.json(
      { success: false, message: "Thiếu submissionId" },
      { status: 400 },
    );
  }
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(submissionId)) {
    return NextResponse.json(
      { success: false, message: "submissionId không hợp lệ (phải là UUID)" },
      { status: 400 },
    );
  }

  const reviewRes = await pool.query(
    `SELECT r.*
     FROM ai_reviews r
     JOIN code_submissions s ON s.id = r.submission_id
     WHERE r.submission_id = $1::uuid
       AND s.interview_id = (SELECT id FROM interviews WHERE meeting_code = $2)
     LIMIT 1`,
    [submissionId, meetingCode],
  );

  if (reviewRes.rows.length === 0) {
    return NextResponse.json({ success: true, review: null, tests: [] });
  }

  const r = reviewRes.rows[0];
  const testsRes = await pool.query(
    `SELECT id, input_data, expected_output, actual_output, status,
            description, edge_case_type, runtime_ms, source, ai_verified
     FROM ai_generated_test_cases
     WHERE submission_id = $1::uuid
     ORDER BY execution_order ASC`,
    [submissionId],
  );
  const tests = testsRes.rows;
  const passed = tests.filter((t) => t.status === "PASSED").length;

  return NextResponse.json({
    success: true,
    review: {
      reviewId: r.id,
      overallScore: Number(r.overall_score ?? r.score ?? 0),
      correctnessScore: Number(r.correctness_score ?? 0),
      algorithmScore: Number(r.algorithm_score ?? 0),
      timeComplexity: r.time_complexity,
      spaceComplexity: r.space_complexity,
      correctness: r.correctness,
      algorithm: r.feedback,
      strengths: r.strengths,
      weaknesses: r.weaknesses,
      hint: r.hint,
      reviewedAt: r.reviewed_at,
      modelName: r.model_name,
      executionMode: r.execution_mode ?? "unknown",
      analysisReason: r.analysis_reason ?? "",
      analysisConfidence: r.analysis_confidence != null ? Number(r.analysis_confidence) : null,
      analysisEntryPoint: r.analysis_entry_point ?? "",
      usesHardcodedValues: r.uses_hardcoded_values === true,
      canAutoRun: r.execution_mode === "stdin",
    },
    tests: {
      total: tests.length,
      passed,
      items: tests.map((t) => ({
        id: t.id,
        description: t.description,
        edgeCaseType: t.edge_case_type,
        inputData: t.input_data,
        expectedOutput: t.expected_output,
        actualOutput: t.actual_output,
        status: t.status,
        runtimeMs: t.runtime_ms,
        source: t.source ?? "AI",
        aiVerified: t.ai_verified,
      })),
    },
  });
}
