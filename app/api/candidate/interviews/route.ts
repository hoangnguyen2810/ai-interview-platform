// GET /api/candidate/interviews
//
// Lịch sử tham gia phỏng vấn của candidate hiện tại — query từ bảng
// `interview_participation_log` (append-only, migration 015).
//
// Tại sao dùng bảng log thay vì interview_candidates?
//   Bảng `interview_candidates` chỉ giữ 1 row UNIQUE theo interview_id
//   (slot hiện tại). Khi candidate A out rồi candidate B vào sau (cơ chế
//   takeover ở lib/interview-guard.ts attachCandidate CASE 3), row cũ
//   bị UPDATE → đổi user_id thành B. Lịch sử A biến mất vĩnh viễn.
//   Bảng `interview_participation_log` INSERT append-only mỗi lượt join
//   → A vẫn còn row trong log → dashboard thấy buổi A đã tham gia.
//
// Group theo interview_id: 1 candidate có thể vào/ra nhiều lần trong
// cùng 1 buổi phỏng vấn (refresh tab, mất kết nối tạm thời...). UI
// hiển thị 1 row / buổi, joined_at = MIN(joined_at), left_at = MAX(left_at).
//
// Query params:
//   - status: SCHEDULED|ONGOING|FINISHED|CANCELLED (optional, mặc định: tất cả)
//   - limit:  số bản ghi (mặc định 20, tối đa 50)
//
// Auth: chỉ CANDIDATE.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest, unauthorized, forbidden } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

interface HistoryRow {
  interview_id: string;
  meeting_code: string;
  title: string;
  interview_status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";
  first_joined_at: Date | string;
  last_left_at: Date | string | null;
  visit_count: string; // pg count(*) trả về string
  has_recording: boolean;
}

export async function GET(req: Request) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();
    if (auth.role !== "CANDIDATE") {
      return forbidden("Chỉ candidate mới xem được lịch sử này");
    }

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");

    let limit = DEFAULT_LIMIT;
    if (limitParam) {
      const parsed = Number(limitParam);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.min(Math.trunc(parsed), MAX_LIMIT);
      }
    }

    const params: unknown[] = [auth.id];
    let whereExtra = "";
    if (
      statusParam &&
      ["SCHEDULED", "ONGOING", "FINISHED", "CANCELLED"].includes(statusParam)
    ) {
      params.push(statusParam);
      whereExtra = `AND i.status = $${params.length}`;
    }
    params.push(limit);

    // Group theo interview_id:
    //   - first_joined_at: lần đầu candidate vào buổi đó
    //   - last_left_at: lần cuối out (NULL nếu vẫn đang trong phòng)
    //   - visit_count: số lượt join (refresh, mất kết nối tạm...)
    //
    // recordings (post-migration 010) dùng `call_cid` dạng
    // "default:<meeting_code>" thay vì meeting_code trực tiếp.
    // EXISTS check phải concat prefix để khớp.
    const result = await pool.query<HistoryRow>(
      `SELECT
         i.id              AS interview_id,
         i.meeting_code    AS meeting_code,
         i.title           AS title,
         i.status          AS interview_status,
         MIN(pl.joined_at) AS first_joined_at,
         MAX(pl.left_at)   AS last_left_at,
         COUNT(*)          AS visit_count,
         EXISTS(
           SELECT 1 FROM recordings r
           WHERE r.call_cid = 'default:' || i.meeting_code
         ) AS has_recording
       FROM interview_participation_log pl
       JOIN interviews i ON i.id = pl.interview_id
       WHERE pl.user_id = $1
         AND i.deleted_at IS NULL
         ${whereExtra}
       GROUP BY i.id, i.meeting_code, i.title, i.status
       ORDER BY MIN(pl.joined_at) DESC
       LIMIT $${params.length}`,
      params,
    );

    const interviews = result.rows.map((row) => ({
      interviewId: row.interview_id,
      meetingCode: row.meeting_code,
      title: row.title,
      status: row.interview_status,
      firstJoinedAt:
        row.first_joined_at instanceof Date
          ? row.first_joined_at.toISOString()
          : row.first_joined_at,
      lastLeftAt:
        row.last_left_at instanceof Date
          ? row.last_left_at.toISOString()
          : row.last_left_at,
      visitCount: Number(row.visit_count),
      hasRecording: row.has_recording,
    }));

    return NextResponse.json({
      success: true,
      interviews,
      total: interviews.length,
    });
  } catch (error) {
    console.error("GET /api/candidate/interviews ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}
