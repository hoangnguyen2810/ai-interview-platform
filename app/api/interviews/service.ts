// Service layer cho interviews.
// Mọi thao tác ghi đều nằm trong transaction; meeting_code sinh tự động
// theo format `NC-XXXXXXXX` (base36, 8 ký tự) và được kiểm tra trùng lặp.

import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import type { CreateInterviewInput, CreateInterviewRow } from "./dto";

// Ký tự không nhầm lẫn: bỏ 0/O, 1/I/L
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function generateMeetingCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    out += CODE_ALPHABET[idx];
  }
  return `NC-${out}`;
}

async function generateUniqueMeetingCode(
  client: PoolClient,
  maxAttempts = 8,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateMeetingCode();
    const exists = await client.query(
      `SELECT 1 FROM interviews WHERE meeting_code = $1 LIMIT 1`,
      [candidate],
    );
    if (exists.rowCount === 0) return candidate;
  }
  // Cực hiếm xảy ra, nhưng đảm bảo không loop vô tận
  throw new Error("Không thể sinh meeting_code duy nhất, vui lòng thử lại");
}

export async function createInterviewForRecruiter(
  recruiterId: string,
  input: CreateInterviewInput,
): Promise<CreateInterviewRow> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Sinh meeting_code unique
    const meetingCode = await generateUniqueMeetingCode(client);

    // 2. Insert vào bảng interviews
    const insertResult = await client.query(
      `
      INSERT INTO interviews (
        title,
        description,
        meeting_code,
        room_password,
        allow_guest,
        max_participants,
        max_interviewers,
        duration_minutes,
        status,
        scheduled_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SCHEDULED', $9)
      RETURNING
        id,
        title,
        description,
        meeting_code,
        room_password,
        allow_guest,
        max_participants,
        max_interviewers,
        duration_minutes,
        status,
        scheduled_at,
        created_at
      `,
      [
        input.title,
        input.description,
        meetingCode,
        input.roomPassword,
        input.allowGuest,
        input.maxParticipants,
        input.maxInterviewers,
        input.durationMinutes,
        input.scheduledAt,
      ],
    );

    const row = insertResult.rows[0];
    const interviewId: string = row.id;

    // 3. Tự động thêm recruiter hiện tại vào interview_participants với HOST
    await client.query(
      `
      INSERT INTO interview_participants (
        interview_id,
        user_id,
        participant_role
      )
      VALUES ($1, $2, 'HOST')
      `,
      [interviewId, recruiterId],
    );

    await client.query("COMMIT");

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      meetingCode: row.meeting_code,
      roomPassword: row.room_password,
      allowGuest: row.allow_guest,
      maxParticipants: row.max_participants,
      maxInterviewers: row.max_interviewers,
      durationMinutes: row.duration_minutes,
      status: row.status,
      scheduledAt: row.scheduled_at,
      createdAt: row.created_at,
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* bỏ qua lỗi rollback */
    }
    throw err;
  } finally {
    client.release();
  }
}
