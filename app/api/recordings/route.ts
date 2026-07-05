// GET /api/recordings
// Trả về danh sách các recording của các interview mà recruiter hiện tại
// đang là HOST hoặc INTERVIEWER. Mỗi recording gồm metadata + URL playback.
//
// Query params:
//   - status: lọc theo status (PROCESSING / AVAILABLE / FAILED). Mặc định: tất cả.
//   - limit: số bản ghi trả về (mặc định 50, tối đa 200).
//
// Chỉ RECRUITER (host của recording) hoặc ADMIN được phép xem.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest, unauthorized, forbidden } from "@/lib/auth";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface RecordingRow {
  id: string;
  interview_id: string;
  meeting_code: string;
  title: string;
  file_name: string;
  file_url: string;
  mime_type: string;
  size_bytes: string | number;
  duration_seconds: number;
  status: "PROCESSING" | "AVAILABLE" | "FAILED";
  recorded_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const ALLOWED_STATUSES = new Set(["PROCESSING", "AVAILABLE", "FAILED"]);

export async function GET(req: Request) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();
    if (auth.role !== "RECRUITER" && auth.role !== "ADMIN") {
      return forbidden("Chỉ recruiter mới xem được recordings");
    }

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");

    const status = statusParam && ALLOWED_STATUSES.has(statusParam)
      ? statusParam
      : null;

    let limit = DEFAULT_LIMIT;
    if (limitParam) {
      const parsed = Number(limitParam);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.min(Math.trunc(parsed), MAX_LIMIT);
      }
    }

    // Recruiter chỉ xem được recordings của các interview mình là HOST/INTERVIEWER.
    // Admin xem tất cả.
    const params: unknown[] = [];
    let where = "rec.deleted_at IS NULL";
    if (auth.role === "RECRUITER") {
      where = `
        rec.deleted_at IS NULL
        AND rec.interview_id IN (
          SELECT interview_id
          FROM interview_participants
          WHERE user_id = $1 AND participant_role IN ('HOST', 'INTERVIEWER')
        )
      `;
      params.push(auth.id);
    }
    if (status) {
      params.push(status);
      where += ` AND rec.status = $${params.length}`;
    }
    params.push(limit);
    const limitIdx = params.length;

    const sql = `
      SELECT
        rec.id,
        rec.interview_id,
        rec.meeting_code,
        rec.title,
        rec.file_name,
        rec.file_url,
        rec.mime_type,
        rec.size_bytes,
        rec.duration_seconds,
        rec.status,
        rec.recorded_by,
        rec.created_at,
        rec.updated_at
      FROM recordings rec
      WHERE ${where}
      ORDER BY rec.created_at DESC
      LIMIT $${limitIdx}
    `;

    const result = await pool.query<RecordingRow>(sql, params);

    const recordings = result.rows.map((r) => ({
      id: r.id,
      interviewId: r.interview_id,
      meetingCode: r.meeting_code,
      title: r.title,
      fileName: r.file_name,
      fileUrl: r.file_url,
      mimeType: r.mime_type,
      sizeBytes:
        typeof r.size_bytes === "string"
          ? Number(r.size_bytes)
          : r.size_bytes,
      durationSeconds: r.duration_seconds,
      status: r.status,
      recordedBy: r.recorded_by,
      createdAt:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : r.created_at,
      updatedAt:
        r.updated_at instanceof Date
          ? r.updated_at.toISOString()
          : r.updated_at,
    }));

    return NextResponse.json({
      success: true,
      recordings,
      total: recordings.length,
    });
  } catch (error) {
    console.error("GET /api/recordings ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}