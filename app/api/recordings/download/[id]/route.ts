// app/api/recordings/download/[id]/route.ts
//
// Proxy tải recording về máy: fetch file từ URL gốc (GetStream CDN) ở
// server-side rồi trả lại cho client kèm header Content-Disposition.
//
// LƯU Ý VỀ ĐƯỜNG DẪN: route này đặt tại /recordings/download/[id] (không
// phải /recordings/[id]/download) vì Next.js App Router KHÔNG cho phép 2
// dynamic segment khác tên ([callCid] và [id]) cùng nằm trực tiếp dưới
// app/api/recordings/. "download" là static segment nên tách được cấp,
// tránh xung đột với app/api/recordings/[callCid]/route.ts.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

interface RecordingRow {
  id: string;
  call_cid: string;
  url: string;
  filename: string | null;
}

async function verifyAccess(
  userId: string,
  role: string,
  callCid: string,
): Promise<boolean> {
  if (role === "ADMIN") return true;

  const meetingCode = callCid.includes(":")
    ? callCid.split(":").slice(1).join(":")
    : callCid;

  if (role === "RECRUITER") {
    const res = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM interview_participants ip
         JOIN interviews i ON i.id = ip.interview_id
         WHERE ip.user_id = $1
           AND i.meeting_code = $2
           AND ip.participant_role IN ('HOST', 'INTERVIEWER')
           AND i.deleted_at IS NULL
       ) AS exists`,
      [userId, meetingCode],
    );
    return Boolean(res.rows[0]?.exists);
  }

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

export async function GET(req: Request, ctx: Params) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "id không hợp lệ" },
        { status: 400 },
      );
    }

    const result = await pool.query<RecordingRow>(
      `SELECT id, call_cid, url, filename
       FROM recordings
       WHERE id = $1`,
      [id],
    );
    const record = result.rows[0];
    if (!record) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy recording" },
        { status: 404 },
      );
    }

    const allowed = await verifyAccess(auth.id, auth.role, record.call_cid);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập" },
        { status: 403 },
      );
    }

    const upstream = await fetch(record.url);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        {
          success: false,
          message: `Không tải được file gốc (HTTP ${upstream.status})`,
        },
        { status: 502 },
      );
    }

    const filename = record.filename ?? `recording-${record.id}.mp4`;
    const contentType = upstream.headers.get("content-type") ?? "video/mp4";
    const contentLength = upstream.headers.get("content-length");

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(
        filename,
      )}`,
    );
    if (contentLength) headers.set("Content-Length", contentLength);

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error("GET /api/recordings/download/[id] ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}
