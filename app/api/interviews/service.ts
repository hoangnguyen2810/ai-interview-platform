// Service layer cho interviews.
// Mọi thao tác ghi đều nằm trong transaction; meeting_code sinh tự động
// theo format `NC-XXXXXXXX` (base36, 8 ký tự) và được kiểm tra trùng lặp.
//
// room_password (plain text từ client) được hash bằng bcrypt trước khi lưu
// vào cột room_password_hash. Không bao giờ lưu plaintext.

import type { PoolClient } from "pg";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import type {
  CreateInterviewInput,
  CreateInterviewRow,
  UpdateInterviewInput,
  UpdateInterviewRow,
} from "./dto";

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
        enable_recording,
        scheduled_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SCHEDULED', $9, $10)
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
        enable_recording,
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
        input.enableRecording,
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
      enableRecording: row.enable_recording,
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

// ---- Update ----

export class InterviewNotFoundError extends Error {
  constructor() {
    super("Không tìm thấy buổi phỏng vấn");
    this.name = "InterviewNotFoundError";
  }
}

export class InterviewNotEditableError extends Error {
  public readonly currentStatus: string;
  constructor(currentStatus: string) {
    super(
      `Chỉ có thể chỉnh sửa buổi phỏng vấn ở trạng thái Đã lên lịch (hiện tại: ${currentStatus})`,
    );
    this.name = "InterviewNotEditableError";
    this.currentStatus = currentStatus;
  }
}

// Trạng thái hiển thị suy luận theo thời gian thực — dùng chung logic với
// GET/DELETE trong route.ts. alias là tên bảng interviews trong câu SQL.
function derivedStatusExpr(alias: string): string {
  return `
    CASE
      WHEN ${alias}.status IN ('FINISHED', 'CANCELLED') THEN ${alias}.status
      WHEN ${alias}.scheduled_at <= NOW() THEN 'ONGOING'
      ELSE 'SCHEDULED'
    END
  `;
}

export async function updateInterviewForRecruiter(
  recruiterId: string,
  interviewId: string,
  input: UpdateInterviewInput,
): Promise<UpdateInterviewRow> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Khoá row (FOR UPDATE) + xác nhận ownership (HOST) + trạng thái hiện tại
    //    trong CÙNG transaction với UPDATE bên dưới, để tránh race condition
    //    (VD: buổi vừa chuyển ONGOING đúng lúc request PATCH tới).
    const ownedResult = await client.query<{
      id: string;
      derived_status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";
    }>(
      `
      SELECT
        i.id,
        ${derivedStatusExpr("i")} AS derived_status
      FROM interviews i
      JOIN interview_participants ip ON ip.interview_id = i.id
      WHERE i.id = $1
        AND i.deleted_at IS NULL
        AND ip.user_id = $2
        AND ip.participant_role = 'HOST'
      LIMIT 1
      FOR UPDATE OF i
      `,
      [interviewId, recruiterId],
    );

    const owned = ownedResult.rows[0];
    if (!owned) {
      throw new InterviewNotFoundError();
    }
    if (owned.derived_status !== "SCHEDULED") {
      throw new InterviewNotEditableError(owned.derived_status);
    }

    // 2. Hash roomPassword mới nếu client gửi field này (kể cả khi gửi null
    //    để XOÁ mật khẩu phòng). undefined nghĩa là "không đổi".
    let passwordHash: string | null | undefined = undefined;
    if (input.roomPassword !== undefined) {
      passwordHash = input.roomPassword
        ? await bcrypt.hash(input.roomPassword, BCRYPT_COST)
        : null;
    }

    // 3. Build UPDATE động — chỉ set field nào thực sự có trong input
    const setClauses: string[] = [];
    const values: unknown[] = [];
    const addField = (column: string, value: unknown) => {
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    };

    if (input.title !== undefined) addField("title", input.title);
    if (input.description !== undefined)
      addField("description", input.description);
    if (passwordHash !== undefined)
      addField("room_password_hash", passwordHash);
    if (input.allowGuest !== undefined)
      addField("allow_guest", input.allowGuest);
    if (input.maxParticipants !== undefined)
      addField("max_participants", input.maxParticipants);
    if (input.maxInterviewers !== undefined)
      addField("max_interviewers", input.maxInterviewers);
    if (input.durationMinutes !== undefined)
      addField("duration_minutes", input.durationMinutes);
    if (input.enableRecording !== undefined)
      addField("enable_recording", input.enableRecording);
    if (input.scheduledAt !== undefined)
      addField("scheduled_at", input.scheduledAt);

    // dto.ts đã chặn trường hợp rỗng, đây là phòng thủ thêm ở service layer
    if (setClauses.length === 0) {
      throw new Error("Không có trường nào để cập nhật");
    }

    values.push(interviewId);

    const updateResult = await client.query(
      `
      UPDATE interviews
      SET ${setClauses.join(", ")}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING
        id,
        title,
        description,
        meeting_code,
        allow_guest,
        max_participants,
        max_interviewers,
        duration_minutes,
        status,
        enable_recording,
        scheduled_at,
        created_at
      `,
      values,
    );

    await client.query("COMMIT");

    const row = updateResult.rows[0];
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      meetingCode: row.meeting_code,
      allowGuest: row.allow_guest,
      maxParticipants: row.max_participants,
      maxInterviewers: row.max_interviewers,
      durationMinutes: row.duration_minutes,
      status: row.status,
      enableRecording: row.enable_recording,
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
