// Service layer cho interviews.
// Mọi thao tác ghi đều nằm trong transaction; meeting_code sinh tự động
// theo format `NC-XXXXXXXX` (base36, 8 ký tự) và được kiểm tra trùng lặp.
//
// room_password (plain text từ client) được hash bằng bcrypt trước khi lưu
// vào cột room_password_hash. Không bao giờ lưu plaintext.

import type { PoolClient } from "pg";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import type { CreateInterviewInput, CreateInterviewRow } from "./dto";

const BCRYPT_COST = 10;

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

    // 2. Hash password (nếu có) bằng bcrypt trước khi lưu
    let passwordHash: string | null = null;
    if (input.roomPassword) {
      passwordHash = await bcrypt.hash(input.roomPassword, BCRYPT_COST);
    }

    // 3. Insert vào bảng interviews
    const insertResult = await client.query(
      `
      INSERT INTO interviews (
        title,
        description,
        meeting_code,
        room_password_hash,
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
        room_password_hash,
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
        passwordHash,
        input.allowGuest,
        input.maxParticipants,
        input.maxInterviewers,
        input.durationMinutes,
        input.scheduledAt,
      ],
    );

    const row = insertResult.rows[0];
    const interviewId: string = row.id;

    // 4. Tự động thêm recruiter hiện tại vào interview_participants với HOST
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

    // Không bao giờ trả password hash về client
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      meetingCode: row.meeting_code,
      roomPassword: input.roomPassword,
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