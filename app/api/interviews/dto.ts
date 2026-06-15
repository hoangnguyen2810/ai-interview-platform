// DTO + validation cho POST /api/interviews
// Toàn bộ giá trị enum dựa theo CHECK constraint trong db/schema.sql.

export type DurationMinutes = 30 | 60 | 90 | 120;
export type MaxInterviewers = 2 | 3;

export interface CreateInterviewInput {
  title: string;
  description: string | null;
  roomPassword: string | null;
  allowGuest: boolean;
  maxParticipants: number;
  maxInterviewers: MaxInterviewers;
  durationMinutes: DurationMinutes;
  scheduledAt: Date;
}

export interface CreateInterviewRow {
  id: string;
  title: string;
  description: string | null;
  meetingCode: string;
  roomPassword: string | null;
  allowGuest: boolean;
  maxParticipants: number;
  maxInterviewers: MaxInterviewers;
  durationMinutes: DurationMinutes;
  status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";
  scheduledAt: Date;
  createdAt: Date;
}

const ALLOWED_DURATIONS: DurationMinutes[] = [30, 60, 90, 120];
const ALLOWED_MAX_INTERVIEWERS: MaxInterviewers[] = [2, 3];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return null;
  return v;
}

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

function asInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) {
    return Math.trunc(Number(v));
  }
  return null;
}

function asDate(v: unknown): Date | null {
  if (typeof v !== "string" && !(v instanceof Date)) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return null;
  return d;
}

export class ValidationError extends Error {
  public readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

export function validateCreateInterviewPayload(
  raw: unknown,
): CreateInterviewInput {
  if (!isPlainObject(raw)) {
    throw new ValidationError("body", "Body phải là JSON object");
  }

  // title: required, string, 1..255
  const titleRaw = asString(raw.title);
  if (titleRaw === null) {
    throw new ValidationError("title", "Tiêu đề là bắt buộc");
  }
  const title = titleRaw.trim();
  if (title.length === 0) {
    throw new ValidationError("title", "Tiêu đề không được để trống");
  }
  if (title.length > 255) {
    throw new ValidationError("title", "Tiêu đề tối đa 255 ký tự");
  }

  // description: optional, string (TEXT)
  let description: string | null = null;
  if (raw.description !== undefined && raw.description !== null) {
    const s = asString(raw.description);
    if (s === null) {
      throw new ValidationError("description", "Mô tả phải là chuỗi");
    }
    description = s.trim() === "" ? null : s.trim();
  }

  // roomPassword: optional, string (VARCHAR 100)
  let roomPassword: string | null = null;
  if (raw.roomPassword !== undefined && raw.roomPassword !== null) {
    const s = asString(raw.roomPassword);
    if (s === null) {
      throw new ValidationError("roomPassword", "Mật khẩu phòng phải là chuỗi");
    }
    const trimmed = s.trim();
    if (trimmed.length > 100) {
      throw new ValidationError("roomPassword", "Mật khẩu phòng tối đa 100 ký tự");
    }
    roomPassword = trimmed === "" ? null : trimmed;
  }

  // allowGuest: optional, boolean, default true
  const allowGuest = asBool(raw.allowGuest, true);

  // maxParticipants: optional, int, >= 1, default 10
  let maxParticipants = 10;
  if (raw.maxParticipants !== undefined && raw.maxParticipants !== null) {
    const n = asInt(raw.maxParticipants);
    if (n === null || n < 1) {
      throw new ValidationError(
        "maxParticipants",
        "Số người tham gia tối đa phải là số nguyên >= 1",
      );
    }
    maxParticipants = n;
  }

  // maxInterviewers: required, must be 2 or 3 (CHECK constraint)
  if (raw.maxInterviewers === undefined || raw.maxInterviewers === null) {
    throw new ValidationError("maxInterviewers", "Số interviewer tối đa là bắt buộc");
  }
  const mi = asInt(raw.maxInterviewers);
  if (mi === null || !ALLOWED_MAX_INTERVIEWERS.includes(mi as MaxInterviewers)) {
    throw new ValidationError(
      "maxInterviewers",
      "Số interviewer tối đa chỉ chấp nhận 2 hoặc 3",
    );
  }

  // durationMinutes: required, must be 30/60/90/120 (CHECK constraint)
  if (raw.durationMinutes === undefined || raw.durationMinutes === null) {
    throw new ValidationError("durationMinutes", "Thời lượng phỏng vấn là bắt buộc");
  }
  const dm = asInt(raw.durationMinutes);
  if (dm === null || !ALLOWED_DURATIONS.includes(dm as DurationMinutes)) {
    throw new ValidationError(
      "durationMinutes",
      "Thời lượng phỏng vấn chỉ chấp nhận 30, 60, 90 hoặc 120 phút",
    );
  }

  // scheduledAt: required, ISO date string, phải ở tương lai
  if (raw.scheduledAt === undefined || raw.scheduledAt === null) {
    throw new ValidationError("scheduledAt", "Thời gian dự kiến là bắt buộc");
  }
  const scheduled = asDate(raw.scheduledAt);
  if (scheduled === null) {
    throw new ValidationError("scheduledAt", "scheduledAt không phải ngày hợp lệ");
  }
  if (scheduled.getTime() <= Date.now()) {
    throw new ValidationError(
      "scheduledAt",
      "scheduledAt phải ở trong tương lai",
    );
  }

  return {
    title,
    description,
    roomPassword,
    allowGuest,
    maxParticipants,
    maxInterviewers: mi as MaxInterviewers,
    durationMinutes: dm as DurationMinutes,
    scheduledAt: scheduled,
  };
}
