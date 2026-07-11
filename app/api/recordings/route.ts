// GET /api/recordings
//
// Trả về danh sách recordings trong DB. UI "/recruiter/recordings" dùng
// endpoint này để list tất cả các recording đã được sync từ GetStream.
//
// Query params:
//   - callCid: lọc theo callCid (optional).
//   - limit:   số bản ghi trả về (mặc định 100, tối đa 500).
//
// Auth:
//   - RECRUITER/ADMIN: xem tất cả.
//   - CANDIDATE:        chỉ xem recordings của callCid mà mình tham gia.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest, unauthorized, forbidden } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RecordingRow {
  id: string;
  call_cid: string;
  url: string;
  filename: string | null;
  duration: number;
  recording_type: string | null;
  created_at: Date | string;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function GET(req: Request) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();

    const url = new URL(req.url);
    const callCid = url.searchParams.get("callCid");
    const limitParam = url.searchParams.get("limit");

    let limit = DEFAULT_LIMIT;
    if (limitParam) {
      const parsed = Number(limitParam);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.min(Math.trunc(parsed), MAX_LIMIT);
      }
    }

    const params: unknown[] = [];
    let where = "1 = 1";

    // Candidate chỉ thấy recording của meeting mình tham gia.
    if (auth.role === "CANDIDATE") {
      params.push(auth.id);
      where = `rec.call_cid IN (
        SELECT ('default:' || i.meeting_code)
        FROM interview_participants ip
        JOIN interviews i ON i.id = ip.interview_id
        WHERE ip.user_id = $1 AND i.deleted_at IS NULL
      )`;
    } else if (auth.role !== "RECRUITER" && auth.role !== "ADMIN") {
      return forbidden("Không có quyền xem recordings");
    }

    if (callCid) {
      params.push(callCid);
      where += ` AND rec.call_cid = $${params.length}`;
    }
    params.push(limit);
    const limitIdx = params.length;

    const result = await pool.query<RecordingRow>(
      `SELECT rec.id, rec.call_cid, rec.url, rec.filename,
              rec.duration, rec.recording_type, rec.created_at
       FROM recordings rec
       WHERE ${where}
       ORDER BY rec.created_at DESC
       LIMIT $${limitIdx}`,
      params,
    );

    const recordings = result.rows.map((row) => ({
      id: row.id,
      callCid: row.call_cid,
      url: row.url,
      filename: row.filename,
      duration: row.duration,
      recordingType: row.recording_type,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at,
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
