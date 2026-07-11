// GET /api/recordings/:callCid
//
// Flow:
//   1. Verify user đăng nhập + có quyền truy cập (HOST/INTERVIEWER/CANDIDATE).
//   2. Gọi streamRecordingService.getCallRecordings(callCid) để fetch từ
//      GetStream API.
//   3. Với mỗi recording, INSERT vào bảng `recordings` với ON CONFLICT
//      (url) DO NOTHING — idempotent, không insert trùng nếu gọi lại.
//
// Response:
//   {
//     success: true,
//     callCid: "default:NC-23G6KRA3",
//     total: 2,            // số recordings lấy được từ GetStream
//     inserted: 1,         // số row MỚI được insert vào DB
//     skipped: 1,          // số row đã có sẵn trong DB (no-op)
//     recordings: [...]    // chi tiết từng recording đã ghi nhận
//   }
//
// Auth:
//   - CANDIDATE: chỉ được sync recordings của interview mà mình tham gia.
//   - RECRUITER/ADMIN: được sync cho mọi interview.
//   - Guest (chưa login): 401.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth";
import {
  getCallRecordings,
  type StreamRecording,
} from "@/lib/stream-recording-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params {
  // Next.js App Router: dynamic params phải await (kể cả khi segment là
  // dynamic route).
  params: Promise<{ callCid: string }>;
}

interface RecordingRow {
  id: string;
  call_cid: string;
  url: string;
  filename: string | null;
  duration: number;
  recording_type: string | null;
  created_at: Date | string;
  interview_id: string | null;
  interview_title: string | null;
}

/**
 * Verify user hiện tại có quyền truy cập callCid. Cho phép:
 *   - RECRUITER/ADMIN: mọi callCid.
 *   - CANDIDATE: chỉ callCid của interview mà user là participant.
 */
async function verifyAccess(
  userId: string,
  role: string,
  callCid: string,
): Promise<boolean> {
  if (role === "RECRUITER" || role === "ADMIN") return true;

  // Candidate: kiểm tra trong interview_participants xem user này có thuộc
  // interview mà callCid thuộc về không. callCid thường có dạng
  // "<callType>:<meetingCode>"; meetingCode nằm trong bảng interviews.
  const meetingCode = callCid.includes(":")
    ? callCid.split(":").slice(1).join(":")
    : callCid;

  const res = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1
       FROM interview_participants ip
       JOIN interviews i ON i.id = ip.interview_id
       WHERE ip.user_id = $1
         AND i.meeting_code = $2
         AND i.deleted_at IS NULL
     ) AS exists`,
    [userId, meetingCode],
  );
  return Boolean(res.rows[0]?.exists);
}

export async function GET(_req: Request, ctx: Params) {
  try {
    // 1. Auth.
    const auth = getAuthUserFromRequest(_req);
    if (!auth) return unauthorized();

    const { callCid } = await ctx.params;
    if (!callCid || typeof callCid !== "string") {
      return NextResponse.json(
        { success: false, message: "callCid không hợp lệ" },
        { status: 400 },
      );
    }

    // 2. Verify access.
    const allowed = await verifyAccess(auth.id, auth.role, callCid);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập" },
        { status: 403 },
      );
    }

    // 3. Fetch từ GetStream.
    let streamRecordings: StreamRecording[];
    try {
      streamRecordings = await getCallRecordings(callCid);
    } catch (err) {
      console.error(
        `[recordings] getCallRecordings failed for ${callCid}:`,
        err,
      );
      return NextResponse.json(
        {
          success: false,
          message:
            err instanceof Error
              ? `Lỗi khi gọi GetStream: ${err.message}`
              : "Lỗi khi gọi GetStream",
        },
        { status: 502 },
      );
    }

    if (streamRecordings.length === 0) {
      // GetStream chưa có recording (host vừa stop, file đang finalize,
      // hoặc thực sự chưa ghi) — trả 200, KHÔNG lỗi.
      return NextResponse.json(
        {
          success: true,
          callCid,
          total: 0,
          inserted: 0,
          skipped: 0,
          recordings: [],
          message:
            "Chưa tìm thấy recording trên GetStream — có thể đang được xử lý",
        },
        { status: 200 },
      );
    }

    // 4. DEDUPE trước khi insert.
    //
    // Lý do: GetStream rotate URL CDN nhưng giữ nguyên `filename` cho cùng
    // file ghi. Nếu chỉ insert theo `url` thì sẽ tạo row mới mỗi lần URL
    // xoay vòng → DB phình to với duplicate rows.
    //
    // Dedup key:
    //   - Row có `filename` (preferred): unique (call_cid, filename).
    //   - Row fallback khi filename IS NULL (GetStream không trả): unique
    //     (call_cid, url) — vẫn chống trùng tuyệt đối với cùng 1 url.
    //
    // Bước thực hiện:
    //   - Query DB lấy existing rows match (call_cid, filename) HOẶC
    //     (call_cid, url) để biết cần SKIP những row nào.
    //   - Lọc streamRecordings → chỉ insert những recording CHƯA có.
    //   - Insert có ON CONFLICT (call_cid, filename) DO NOTHING.
    let insertedCount = 0;
    let skippedCount = 0;
    const persistedIds: string[] = [];

    // 4a'. Resolve interview_id + interview_title từ interviews theo
    //      meeting_code (parse ra từ callCid "default:NC-XXX" → "NC-XXX").
    //
    //      Snapshot title tại thời điểm sync → nếu user đổi title interview
    //      sau này, recording vẫn hiển thị tên gốc.
    //
    //      KHÔNG BLOCK INSERT nếu không match — 2 cột có thể NULL (vd
    //      call do test/spam không có interview tương ứng).
    const meetingCode = callCid.includes(":")
      ? callCid.split(":").slice(1).join(":")
      : callCid;

    const interviewRes = await pool.query<{
      id: string;
      title: string;
    }>(
      `SELECT id, title FROM interviews
       WHERE meeting_code = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [meetingCode],
    );
    const interview = interviewRes.rows[0]; // null nếu không tìm thấy

    // 4a. Lấy các key đã tồn tại trong DB để so khớp.
    const existingRes = await pool.query<{
      filename: string | null;
      url: string;
    }>(
      `SELECT filename, url FROM recordings WHERE call_cid = $1`,
      [callCid],
    );

    const existingFilenames = new Set<string>();
    const existingUrls = new Set<string>();
    for (const e of existingRes.rows) {
      if (e.filename) existingFilenames.add(e.filename);
      existingUrls.add(e.url);
    }

    // 4b. Lọc ra những recording thật sự MỚI.
    const toInsert = streamRecordings.filter((r) => {
      if (r.filename) {
        if (existingFilenames.has(r.filename)) return false;
      } else {
        if (existingUrls.has(r.url)) return false;
      }
      return true;
    });

    // 4c. Tính skipped cho phần response (bao gồm cả filename/url match).
    skippedCount = streamRecordings.length - toInsert.length;

    // 4d. INSERT + ON CONFLICT (đề phòng race condition giữa 2 request).
    for (const r of toInsert) {
      const res = await pool.query<{ id: string }>(
        `
        INSERT INTO recordings (
          call_cid,
          url,
          filename,
          duration,
          recording_type,
          created_at,
          interview_id,
          interview_title
        )
        VALUES (
          $1, $2, $3, $4, $5,
          COALESCE($6::timestamptz, CURRENT_TIMESTAMP),
          $7, $8
        )
        ON CONFLICT (call_cid, filename)
          WHERE filename IS NOT NULL
          DO NOTHING
        RETURNING id
        `,
        [
          callCid,
          r.url,
          r.filename,
          r.duration,
          r.recording_type,
          r.created_at ? r.created_at.toISOString() : null,
          interview?.id ?? null,
          interview?.title ?? null,
        ],
      );
      let row = res.rows[0];

      // Fallback: row có filename = NULL, ON CONFLICT filename không
      // trigger (vì partial index yêu cầu filename NOT NULL). Insert lần 2
      // với ON CONFLICT url — vẫn idempotent, không bao giờ trùng URL.
      if (!row && !r.filename) {
        const res2 = await pool.query<{ id: string }>(
          `INSERT INTO recordings (
              call_cid, url, filename, duration, recording_type,
              created_at, interview_id, interview_title
            ) VALUES (
              $1, $2, $3, $4, $5,
              COALESCE($6::timestamptz, CURRENT_TIMESTAMP),
              $7, $8
            )
            ON CONFLICT (url) DO NOTHING
            RETURNING id`,
          [
            callCid,
            r.url,
            r.filename,
            r.duration,
            r.recording_type,
            r.created_at ? r.created_at.toISOString() : null,
            interview?.id ?? null,
            interview?.title ?? null,
          ],
        );
        row = res2.rows[0];
      }

      if (row) {
        insertedCount += 1;
        persistedIds.push(row.id);
      } else {
        // Race với request khác vừa INSERT cùng key → coi như skipped.
        skippedCount += 1;
      }
    }

    // 5. Lấy lại rows vừa lưu (cả mới + cũ) để trả về chi tiết cho client.
    //    Dùng (call_cid, filename) hoặc (call_cid, url) làm lookup.
    const lookup = await pool.query<RecordingRow>(
      `SELECT id, call_cid, url, filename, duration, recording_type, created_at,
             interview_id, interview_title
       FROM recordings
       WHERE call_cid = $1
         AND (
           filename = ANY($2::text[])
           OR url = ANY($3::text[])
         )`,
      [
        callCid,
        streamRecordings
          .map((r) => r.filename)
          .filter((f): f is string => Boolean(f)),
        streamRecordings.map((r) => r.url),
      ],
    );

    const recordings = lookup.rows.map((row) => ({
      id: row.id,
      callCid: row.call_cid,
      url: row.url,
      filename: row.filename,
      duration: row.duration,
      recordingType: row.recording_type,
      interviewId: row.interview_id,
      interviewTitle: row.interview_title,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at,
    }));

    return NextResponse.json(
      {
        success: true,
        callCid,
        total: streamRecordings.length,
        inserted: insertedCount,
        skipped: skippedCount,
        recordings,
        message:
          insertedCount > 0
            ? `Đã đồng bộ: ${insertedCount} mới, ${skippedCount} đã có`
            : skippedCount > 0
              ? `Tất cả ${skippedCount} recording đã có trong DB (skip trùng)`
              : "Không tìm thấy recording mới",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/recordings/[callCid] ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}
