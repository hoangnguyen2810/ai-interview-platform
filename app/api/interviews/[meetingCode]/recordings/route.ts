// POST /api/interviews/[meetingCode]/recordings
//
// Endpoint client-side: InterviewRoomClient gọi khi nhận event
// `call.recording_ready` từ GetStream SDK (hoặc sau khi stopRecording)
// để server chủ động fetch recordings từ GetStream và INSERT vào DB.
//
// Vì sao cần server chủ động fetch?
//   1. Webhook cần được recruiter cấu hình thủ công trên Stream Dashboard.
//      Nếu webhook chưa cấu hình → DB rỗng dù Stream đã có recording.
//   2. SDK event `call.recording_ready` thường KHÔNG chứa URL/filename
//      (tuỳ version SDK và loại recording: composite/individual/raw).
//      Server dùng `@stream-io/node-sdk` để gọi `call.listRecordings()`
//      lấy danh sách đầy đủ rồi insert.
//
// Body payload (optional):
//   {
//     fileName?: string,
//     fileUrl?: string,
//     mimeType?: string,
//     durationSeconds?: number,
//     sizeBytes?: number,
//     /** Bật cờ này để bỏ qua payload client, chỉ sync từ Stream.
//      *  Mặc định: false (merge payload + Stream). */
//     forceSync?: boolean
//   }
//
// Response:
//   { success: true, recordingIds: string[], synced: number }
//
// GET /api/interviews/[meetingCode]/recordings
// Trả về danh sách recordings của 1 interview (cho UI xem trong phòng).

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth";
import { listCallRecordings } from "@/lib/stream-server";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ meetingCode: string }>;
}

interface InterviewRow {
  id: string;
  title: string;
}

interface ParticipantRow {
  participant_role: "HOST" | "INTERVIEWER";
}

interface CandidateRow {
  user_id: string | null;
}

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.max(0, Math.trunc(v));
  }
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) {
    return Math.max(0, Math.trunc(Number(v)));
  }
  return null;
}

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

/**
 * Verify user hiện tại là participant của interview.
 * Trả về true nếu hợp lệ.
 */
async function verifyParticipant(
  interviewId: string,
  auth: { id: string; role: "CANDIDATE" | "RECRUITER" | "ADMIN" },
): Promise<boolean> {
  if (auth.role === "RECRUITER" || auth.role === "ADMIN") {
    const partRes = await pool.query<ParticipantRow>(
      `SELECT participant_role
       FROM interview_participants
       WHERE interview_id = $1 AND user_id = $2
       LIMIT 1`,
      [interviewId, auth.id],
    );
    return Boolean(partRes.rows[0]);
  }
  if (auth.role === "CANDIDATE") {
    const candRes = await pool.query<CandidateRow>(
      `SELECT user_id FROM interview_candidates
       WHERE interview_id = $1 LIMIT 1`,
      [interviewId],
    );
    const cand = candRes.rows[0];
    return Boolean(cand && cand.user_id === auth.id);
  }
  return false;
}

/**
 * Insert 1 recording row. Dùng ON CONFLICT trên file_url để idempotent.
 */
async function upsertRecording(input: {
  interviewId: string;
  meetingCode: string;
  title: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
  recordedBy: string;
}): Promise<string | null> {
  const res = await pool.query<{ id: string }>(
    `
    INSERT INTO recordings (
      interview_id,
      meeting_code,
      title,
      file_name,
      file_url,
      mime_type,
      size_bytes,
      duration_seconds,
      status,
      recorded_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AVAILABLE', $9)
    ON CONFLICT (file_url) DO UPDATE
      SET title = EXCLUDED.title,
          file_name = EXCLUDED.file_name,
          size_bytes = EXCLUDED.size_bytes,
          duration_seconds = EXCLUDED.duration_seconds,
          updated_at = CURRENT_TIMESTAMP
    RETURNING id
    `,
    [
      input.interviewId,
      input.meetingCode,
      input.title,
      input.fileName,
      input.fileUrl,
      input.mimeType,
      input.sizeBytes,
      input.durationSeconds,
      input.recordedBy,
    ],
  );
  return res.rows[0]?.id ?? null;
}

export async function POST(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();

    const { meetingCode } = await ctx.params;

    const interview = await findInterview(meetingCode);
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    const isParticipant = await verifyParticipant(interview.id, auth);
    if (!isParticipant) {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập" },
        { status: 403 },
      );
    }

    // Parse body (optional)
    const raw = await req.json().catch(() => ({}));
    const body = (raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {}) as Record<string, unknown>;

    const payloadFileName = asString(body.fileName);
    const payloadFileUrl = asString(body.fileUrl);
    const payloadMime =
      asString(body.mimeType) ?? "video/webm";
    const payloadDuration = asInt(body.durationSeconds) ?? 0;
    const payloadSize = asInt(body.sizeBytes) ?? 0;
    const forceSync = Boolean(body.forceSync);

    const recordingIds: string[] = [];

    // 1. Server-side fetch từ GetStream (ưu tiên vì có URL/file chính xác nhất).
    //    Áp dụng cho mọi call — kể cả khi client có payload vì URL từ GetStream
    //    là dạng signed URL có thể đã expire, cần refresh.
    //    Bỏ qua nếu forceSync=true nhưng không có payload (giữ nguyên fallback).
    let streamRecordings: Awaited<ReturnType<typeof listCallRecordings>> = [];
    try {
      streamRecordings = await listCallRecordings("default", meetingCode);
    } catch (err) {
      console.warn(
        "[recordings] listCallRecordings threw, continuing without it:",
        err instanceof Error ? err.message : err,
      );
    }

    for (const r of streamRecordings) {
      const id = await upsertRecording({
        interviewId: interview.id,
        meetingCode,
        title: interview.title,
        fileName: r.filename,
        fileUrl: r.url,
        mimeType: payloadMime,
        sizeBytes: 0,
        durationSeconds: 0,
        recordedBy: auth.id,
      });
      if (id) recordingIds.push(id);
    }

    // 2. Nếu client có payload riêng VÀ forceSync=false → INSERT thêm
    //    (phòng case webhook / SDK event có URL mà Stream API chưa thấy).
    if (!forceSync && payloadFileUrl) {
      const safeFileName =
        payloadFileName ?? `${meetingCode}-${Date.now()}.webm`;
      const id = await upsertRecording({
        interviewId: interview.id,
        meetingCode,
        title: interview.title,
        fileName: safeFileName,
        fileUrl: payloadFileUrl,
        mimeType: payloadMime,
        sizeBytes: payloadSize,
        durationSeconds: payloadDuration,
        recordedBy: auth.id,
      });
      if (id) recordingIds.push(id);
    }

    // Nếu cả 2 nguồn đều rỗng → trả 200 + synced=0 để client biết chưa có.
    // KHÔNG trả lỗi vì recording có thể vẫn đang được xử lý trên Stream.
    return NextResponse.json(
      {
        success: true,
        recordingIds,
        synced: recordingIds.length,
        message:
          recordingIds.length > 0
            ? "Đã đồng bộ recording từ GetStream"
            : "Chưa tìm thấy recording trên GetStream — có thể đang được xử lý",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "POST /api/interviews/[meetingCode]/recordings ERROR:",
      error,
    );
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}

interface RecordingListRow {
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

/**
 * GET /api/interviews/[meetingCode]/recordings
 * Trả về recordings của 1 interview cụ thể (participant-only).
 */
export async function GET(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();

    const { meetingCode } = await ctx.params;

    const interview = await findInterview(meetingCode);
    if (!interview) {
      return NextResponse.json(
        { success: false, message: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    const isParticipant = await verifyParticipant(interview.id, auth);
    if (!isParticipant) {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập" },
        { status: 403 },
      );
    }

    const result = await pool.query<RecordingListRow>(
      `SELECT id, interview_id, meeting_code, title, file_name, file_url,
              mime_type, size_bytes, duration_seconds, status, recorded_by,
              created_at, updated_at
       FROM recordings
       WHERE interview_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 100`,
      [interview.id],
    );

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
    console.error(
      "GET /api/interviews/[meetingCode]/recordings ERROR:",
      error,
    );
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}