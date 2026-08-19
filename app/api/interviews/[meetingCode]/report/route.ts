// API Route: /api/interviews/[meetingCode]/report
//
// GET    → List all reports for an interview (recruiter-only), sorted newest
//          first. Returns `reports: [...]`. Each report still carries its
//          full content + snapshots, so the UI can render any of them.
// POST   → Generate a NEW report via AI (calls ai/app/api/report.py), saves
//          to interview_reports table. ALWAYS inserts a new row (interview
//          can now have multiple reports). Status -> DRAFT.
// PATCH  → Update recruiter edits for a SPECIFIC report (by ?reportId=...):
//          content + status (FINAL/DRAFT/EDITED).
// DELETE → Soft-delete a specific report (by ?reportId=...).
//
// Permission: recruiter/admin who is a participant of the interview (matches
// the same gate used in recordings route.ts).

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/auth";
import {
  generateReportViaAI,
  aggregateCodingAnalysis,
  type ReportContent,
} from "@/lib/ai-report";

interface Params {
  params: Promise<{ meetingCode: string }>;
}

interface InterviewRow {
  id: string;
  title: string | null;
}

interface ParticipantRow {
  participant_role: string;
}

interface CandidateRow {
  user_id: string | null;
  candidate_name: string | null;
}

interface ReportRow {
  id: string;
  interview_id: string;
  content: ReportContent;
  cv_filename: string | null;
  cv_markdown: string | null;
  cv_analysis: string | null;
  coding_analysis_snapshot: string | null;
  ai_overall_score: string | number | null;
  ai_model: string | null;
  status: string;
  generated_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

const EMPTY_CONTENT: ReportContent = {
  candidate_name: "",
  position: "",
  summary: "",
  strengths: "",
  weaknesses: "",
  skill_evaluation: "",
  improvement_suggestions: "",
  hiring_conclusion: "",
};

async function findInterview(
  meetingCode: string,
): Promise<InterviewRow | null> {
  const res = await pool.query<InterviewRow>(
    `SELECT id, title FROM interviews
     WHERE meeting_code = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [meetingCode],
  );
  return res.rows[0] ?? null;
}

async function verifyRecruiterParticipant(
  interviewId: string,
  auth: { id: string; role: "CANDIDATE" | "RECRUITER" | "ADMIN" },
): Promise<boolean> {
  if (auth.role === "ADMIN") return true;
  if (auth.role !== "RECRUITER") return false;
  const partRes = await pool.query<ParticipantRow>(
    `SELECT participant_role
     FROM interview_participants
     WHERE interview_id = $1 AND user_id = $2
     LIMIT 1`,
    [interviewId, auth.id],
  );
  return Boolean(partRes.rows[0]);
}

async function fetchCandidateContext(
  interviewId: string,
): Promise<{ candidateName: string; candidateEmail: string | null }> {
  const res = await pool.query<CandidateRow>(
    `SELECT user_id, candidate_name FROM interview_candidates
     WHERE interview_id = $1 LIMIT 1`,
    [interviewId],
  );
  const row = res.rows[0];
  return {
    candidateName: row?.candidate_name ?? "",
    candidateEmail: null,
  };
}

async function fetchCodingAnalysisRows(interviewId: string): Promise<
  Array<{
    submission_id: string;
    language: string | null;
    score: number | null;
    strengths: string | null;
    weaknesses: string | null;
    feedback: string | null;
  }>
> {
  const res = await pool.query(
    `SELECT
       cs.id AS submission_id,
       cs.language,
       ar.score,
       ar.strengths,
       ar.weaknesses,
       ar.feedback
     FROM code_submissions cs
     LEFT JOIN ai_reviews ar ON ar.submission_id = cs.id
     WHERE cs.interview_id = $1
     ORDER BY cs.created_at ASC`,
    [interviewId],
  );
  return res.rows;
}

function serializeReport(row: ReportRow) {
  return {
    id: row.id,
    content: row.content ?? EMPTY_CONTENT,
    cv_filename: row.cv_filename,
    cv_analysis: row.cv_analysis,
    coding_analysis_snapshot: row.coding_analysis_snapshot,
    ai_overall_score:
      row.ai_overall_score !== null && row.ai_overall_score !== undefined
        ? Number(row.ai_overall_score)
        : null,
    ai_model: row.ai_model,
    status: row.status,
    generated_at: row.generated_at,
    updated_at: row.updated_at,
  };
}

// ─── GET — list all reports for the interview ─────────────────────────────────

export async function GET(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập" },
        { status: 401 },
      );
    }

    const { meetingCode } = await ctx.params;
    const interview = await findInterview(meetingCode);
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    const allowed = await verifyRecruiterParticipant(interview.id, auth);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập" },
        { status: 403 },
      );
    }

    const res = await pool.query<ReportRow>(
      `SELECT
         id, interview_id, content,
         cv_filename, cv_markdown, cv_analysis,
         coding_analysis_snapshot,
         ai_overall_score, ai_model, status,
         generated_at, updated_at, created_by, updated_by
       FROM interview_reports
       WHERE interview_id = $1 AND deleted_at IS NULL
       ORDER BY generated_at DESC, updated_at DESC`,
      [interview.id],
    );

    return NextResponse.json({
      success: true,
      reports: res.rows.map(serializeReport),
    });
  } catch (error) {
    console.error("GET /report ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi máy chủ" },
      { status: 500 },
    );
  }
}

// ─── POST — generate a NEW report (always inserts, never overwrites) ──────────

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
    const interview = await findInterview(meetingCode);
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    const allowed = await verifyRecruiterParticipant(interview.id, auth);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập" },
        { status: 403 },
      );
    }

    // Optional body: override CV inputs from recruiter (otherwise pulled from
    // existing snapshot or empty).
    let body: {
      cv_filename?: string;
      cv_markdown?: string;
      cv_analysis?: string;
      position?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      // body is optional
    }

    const candidate = await fetchCandidateContext(interview.id);
    const reviews = await fetchCodingAnalysisRows(interview.id);
    const codingAnalysisText = aggregateCodingAnalysis(reviews);

    // Use whatever CV info was passed in body, else empty.
    const cvFilename = body.cv_filename?.trim() ?? "";
    const cvMarkdown = body.cv_markdown?.trim() ?? "";
    const cvAnalysis = body.cv_analysis?.trim() ?? "";

    const generated = await generateReportViaAI({
      cv_filename: cvFilename,
      cv_analysis: cvAnalysis,
      coding_analysis: codingAnalysisText,
      candidate_name: candidate.candidateName,
      position: body.position?.trim() ?? "",
    });

    // Compute a rough overall_score suggestion: average of review scores
    // (rounded to 2 decimals). Null if no reviews.
    let aiOverall: number | null = null;
    const scored = reviews
      .map((r) => r.score)
      .filter((v): v is number => typeof v === "number");
    if (scored.length) {
      aiOverall =
        Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) /
        100;
    }

    // Always INSERT a new row. Each AI generation becomes its own report
    // so the recruiter can compare versions or pick the best one.
    const insertRes = await pool.query<ReportRow>(
      `INSERT INTO interview_reports (
         interview_id, content,
         cv_filename, cv_markdown, cv_analysis,
         coding_analysis_snapshot,
         ai_overall_score, ai_model, status,
         created_by, updated_by
       )
       VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, 'DRAFT', $9, $9)
       RETURNING id, content, status, generated_at, updated_at,
                 cv_filename, cv_analysis, coding_analysis_snapshot,
                 ai_overall_score, ai_model`,
      [
        interview.id,
        JSON.stringify(generated.report),
        cvFilename || null,
        cvMarkdown || null,
        cvAnalysis || null,
        codingAnalysisText || null,
        aiOverall,
        generated.model,
        auth.id,
      ],
    );

    const saved = insertRes.rows[0];

    return NextResponse.json(
      {
        success: true,
        report: serializeReport(saved),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /report ERROR:", error);
    const message = error instanceof Error ? error.message : "Lỗi máy chủ";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// ─── PATCH — recruiter edits on a specific report ────────────────────────────

const VALID_STATUSES = new Set(["DRAFT", "EDITED", "FINAL"]);

function isStringRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// FIX: helper mới — chuyển ĐỔI bất kỳ kiểu dữ liệu nào (string/array/object/
// number/...) về text thay vì loại bỏ nó. Trước đây `sanitizeContent` chỉ
// nhận giá trị khi `typeof v === "string"`; nếu AI trả về field dạng mảng
// (ví dụ strengths: ["a", "b"]) thì field đó bị âm thầm reset về "" mỗi lần
// recruiter PATCH (kể cả khi họ không đụng vào field đó) — đây chính là bug
// "mất dữ liệu AI đã cho khi chỉnh sửa xong lưu".
function stringifyContentValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v
      .map((item) =>
        typeof item === "string" ? item.trim() : stringifyContentValue(item),
      )
      .filter(Boolean)
      .map((item) => `- ${item}`)
      .join("\n");
  }
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return "";
    }
  }
  return String(v);
}

function sanitizeContent(raw: unknown): ReportContent {
  const out: ReportContent = { ...EMPTY_CONTENT };
  if (!isStringRecord(raw)) return out;
  for (const key of Object.keys(EMPTY_CONTENT) as Array<keyof ReportContent>) {
    // FIX: chỉ giữ default "" khi key HOÀN TOÀN không có trong payload gửi
    // lên. Nếu key có mặt (dù kiểu gì) thì convert bằng stringifyContentValue
    // thay vì âm thầm loại bỏ như trước — không còn mất dữ liệu AI nữa.
    if (key in raw) {
      out[key] = stringifyContentValue(raw[key]).slice(0, 5000);
    }
  }
  return out;
}

export async function PATCH(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập" },
        { status: 401 },
      );
    }

    const { meetingCode } = await ctx.params;
    const interview = await findInterview(meetingCode);
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    const allowed = await verifyRecruiterParticipant(interview.id, auth);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập" },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const reportId = url.searchParams.get("reportId");
    if (!reportId) {
      return NextResponse.json(
        { success: false, message: "Thiếu reportId" },
        { status: 400 },
      );
    }

    let body: {
      content?: unknown;
      status?: string;
      ai_overall_score?: number | null;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Body JSON không hợp lệ" },
        { status: 400 },
      );
    }

    const content = sanitizeContent(body.content);
    const hasContent = isStringRecord(body.content);

    // Status: only allow EDITED/FINAL/DRAFT via PATCH.
    let nextStatus: string | null = null;
    if (body.status && VALID_STATUSES.has(body.status)) {
      nextStatus = body.status;
    }

    // Optional score override
    let aiOverall: number | null | undefined = undefined;
    if (body.ai_overall_score === null) {
      aiOverall = null;
    } else if (typeof body.ai_overall_score === "number") {
      aiOverall = Math.max(0, Math.min(10, body.ai_overall_score));
    }

    // Build dynamic SET clause based on which fields are provided.
    // Important: only overwrite `content` when the client actually sent a
    // content object — otherwise (e.g. "Đánh dấu hoàn tất" with just
    // { status: "FINAL" }) we would clobber the existing content with the
    // empty default and silently wipe the report body.
    const setFragments: string[] = [
      "updated_at = CURRENT_TIMESTAMP",
      "updated_by = $2",
    ];
    const params: unknown[] = [interview.id, auth.id, reportId];

    if (hasContent) {
      params.push(JSON.stringify(content));
      setFragments.push(`content = $${params.length}::jsonb`);
    }
    if (nextStatus !== null) {
      params.push(nextStatus);
      setFragments.push(`status = $${params.length}`);
    }
    if (aiOverall !== undefined) {
      params.push(aiOverall);
      setFragments.push(`ai_overall_score = $${params.length}`);
    }

    const updateRes = await pool.query<ReportRow>(
      `UPDATE interview_reports
       SET ${setFragments.join(", ")}
       WHERE interview_id = $1 AND id = $3 AND deleted_at IS NULL
       RETURNING id, content, status, generated_at, updated_at,
                 cv_filename, cv_analysis, coding_analysis_snapshot,
                 ai_overall_score, ai_model`,
      params,
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Không tìm thấy báo cáo để chỉnh sửa.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      report: serializeReport(updateRes.rows[0]),
    });
  } catch (error) {
    console.error("PATCH /report ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi máy chủ" },
      { status: 500 },
    );
  }
}

// ─── DELETE — soft-delete a specific report ──────────────────────────────────

export async function DELETE(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập" },
        { status: 401 },
      );
    }

    const { meetingCode } = await ctx.params;
    const interview = await findInterview(meetingCode);
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    const allowed = await verifyRecruiterParticipant(interview.id, auth);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập" },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const reportId = url.searchParams.get("reportId");
    if (!reportId) {
      return NextResponse.json(
        { success: false, message: "Thiếu reportId" },
        { status: 400 },
      );
    }

    const delRes = await pool.query(
      `UPDATE interview_reports
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           updated_by = $3
       WHERE interview_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [interview.id, reportId, auth.id],
    );

    if (delRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy báo cáo để xoá." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /report ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi máy chủ" },
      { status: 500 },
    );
  }
}
