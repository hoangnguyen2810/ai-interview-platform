import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth";
import { pool } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const auth = getAuthUserFromRequest(req);
  if (!auth) return unauthorized();

  const { searchParams } = new URL(req.url);
  const roleParam = searchParams.get("role"); // "INTERVIEWER" | "CANDIDATE"

  const cookieStore = await cookies();
  const meetingCodeCookie = cookieStore.get("interview_meeting_code");

  if (!meetingCodeCookie?.value) {
    return NextResponse.json(
      { success: false, message: "Không tìm thấy meeting code" },
      { status: 400 },
    );
  }

  const meetingCode = meetingCodeCookie.value;

  try {
    const interviewRes = await pool.query<{ id: string }>(
      `SELECT id FROM interviews WHERE meeting_code = $1 LIMIT 1`,
      [meetingCode],
    );
    if (!interviewRes.rows[0]) {
      return NextResponse.json(
        { success: false, message: "Interview không tồn tại" },
        { status: 404 },
      );
    }
    const interviewId = interviewRes.rows[0].id;

    if (roleParam === "INTERVIEWER") {
      const row = await pool.query<{ full_name: string }>(
        `SELECT u.full_name
         FROM interview_participants ip
         JOIN users u ON u.id = ip.user_id
         WHERE ip.interview_id = $1 AND ip.participant_role = 'HOST'
         LIMIT 1`,
        [interviewId],
      );
      return NextResponse.json({
        success: true,
        participant: row.rows[0] ?? null,
      });
    }

    if (roleParam === "CANDIDATE") {
      const row = await pool.query<{ candidate_name: string | null; full_name: string | null }>(
        `SELECT ic.candidate_name, u.full_name
         FROM interview_candidates ic
         LEFT JOIN users u ON u.id = ic.user_id
         WHERE ic.interview_id = $1
         LIMIT 1`,
        [interviewId],
      );
      const participant = row.rows[0];
      return NextResponse.json({
        success: true,
        participant: {
          candidate_name: participant?.candidate_name,
          full_name: participant?.full_name,
        },
      });
    }

    return NextResponse.json(
      { success: false, message: "role param không hợp lệ" },
      { status: 400 },
    );
  } catch (err) {
    console.error("[GET /api/interview-participants]", err);
    return NextResponse.json(
      { success: false, message: "Lỗi server" },
      { status: 500 },
    );
  }
}
