// POST /api/webhooks/stream/recording-ready
//
// Webhook được GetStream gọi khi một recording đã được tạo và sẵn sàng.
//
// GetStream gửi payload dạng (xem https://getstream.io/video/docs/api/recording/):
//   {
//     "type": "call.recording_ready",
//     "call_cid": "default:NC-XXXXXXXX",
//     "created_at": "...",
//     "recording": {
//       "filename": "...",
//       "url": "https://...",
//       "recording_type": "raw"|"composite"|"individual",
//       "duration": 1234
//     }
//   }
//
// Endpoint này xác thực bằng STREAM_WEBHOOK_SECRET nếu được cấu hình (header
// `x-stream-signature`). Nếu không có secret thì chỉ log + skip (chế độ dev).
//
// Khi nhận được, ta INSERT/UPDATE row vào bảng `recordings` để list ở
// /recruiter/recordings.

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

interface RecordingPayload {
  filename?: string;
  url?: string;
  recording_type?: string;
  duration?: number;
}

interface WebhookBody {
  type?: string;
  call_cid?: string;
  created_at?: string;
  recording?: RecordingPayload;
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.STREAM_WEBHOOK_SECRET;
  if (!secret) {
    // Không có secret → cho phép (chế độ dev).
    console.warn(
      "[stream-webhook] STREAM_WEBHOOK_SECRET not set — skipping verification",
    );
    return true;
  }
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function extractMeetingCode(callCid: string | undefined): string | null {
  if (!callCid) return null;
  // call_cid thường có dạng "default:NC-XXXXXXXX"
  const idx = callCid.indexOf(":");
  return idx >= 0 ? callCid.slice(idx + 1) : callCid;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    const signature =
      req.headers.get("x-stream-signature") ??
      req.headers.get("X-Stream-Signature");

    if (!verifySignature(rawBody, signature)) {
      console.warn("[stream-webhook] invalid signature");
      return NextResponse.json(
        { success: false, message: "Invalid signature" },
        { status: 401 },
      );
    }

    const body = ((): WebhookBody | null => {
      try {
        return JSON.parse(rawBody) as WebhookBody;
      } catch {
        return null;
      }
    })();

    if (!body) {
      return NextResponse.json(
        { success: false, message: "Body không phải JSON" },
        { status: 400 },
      );
    }

    if (body.type !== "call.recording_ready") {
      // Bỏ qua các event khác — endpoint này chỉ xử lý recording_ready.
      return NextResponse.json({ success: true, ignored: true });
    }

    const meetingCode = extractMeetingCode(body.call_cid);
    if (!meetingCode) {
      console.warn("[stream-webhook] missing call_cid");
      return NextResponse.json(
        { success: false, message: "Missing call_cid" },
        { status: 400 },
      );
    }

    const recording = body.recording ?? {};
    const fileUrl = recording.url ?? "";
    const fileName =
      recording.filename ?? `${meetingCode}-${Date.now()}.webm`;

    if (!fileUrl) {
      console.warn("[stream-webhook] missing recording.url");
      return NextResponse.json(
        { success: false, message: "Missing recording.url" },
        { status: 400 },
      );
    }

    // Lấy interview_id + title từ meeting_code
    const interviewRes = await pool.query<{
      id: string;
      title: string;
    }>(
      `SELECT id, title FROM interviews
       WHERE meeting_code = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [meetingCode],
    );
    const interview = interviewRes.rows[0];
    if (!interview) {
      console.warn(
        "[stream-webhook] interview not found for meeting_code:",
        meetingCode,
      );
      return NextResponse.json(
        { success: false, message: "Interview not found" },
        { status: 404 },
      );
    }

    // INSERT với ON CONFLICT để tránh duplicate nếu webhook được retry.
    // file_url là natural key vì GetStream luôn trả URL unique.
    const insertResult = await pool.query<{ id: string }>(
      `
      INSERT INTO recordings (
        interview_id,
        meeting_code,
        title,
        file_name,
        file_url,
        mime_type,
        duration_seconds,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'AVAILABLE')
      ON CONFLICT (file_url) DO UPDATE
        SET title = EXCLUDED.title,
            duration_seconds = EXCLUDED.duration_seconds,
            updated_at = CURRENT_TIMESTAMP
      RETURNING id
      `,
      [
        interview.id,
        meetingCode,
        interview.title,
        fileName,
        fileUrl,
        "video/webm",
        Math.max(0, Math.trunc(recording.duration ?? 0)),
      ],
    );

    const recordingId = insertResult.rows[0]?.id ?? null;
    console.log("[stream-webhook] recording saved", {
      recordingId,
      meetingCode,
      interviewId: interview.id,
    });

    return NextResponse.json({
      success: true,
      recordingId,
      meetingCode,
    });
  } catch (error) {
    console.error("[stream-webhook] ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}