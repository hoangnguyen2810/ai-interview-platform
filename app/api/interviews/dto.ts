// DTO + validation cho /api/interviews (POST tạo mới, PATCH chỉnh sửa)
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
  enableRecording: boolean;
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
  enableRecording: boolean;
  scheduledAt: Date;
  createdAt: Date;
}

// ---- Update DTO (PATCH /api/interviews?id=...) ----
// Mọi field đều optional: chỉ field nào client gửi lên mới bị validate + update.

export interface UpdateInterviewInput {
  title?: string;
  description?: string | null;
  roomPassword?: string | null;
  allowGuest?: boolean;
  maxParticipants?: number;
  maxInterviewers?: MaxInterviewers;
  durationMinutes?: DurationMinutes;
  enableRecording?: boolean;
  scheduledAt?: Date;
}

// Không có roomPassword — service không bao giờ trả password/hash về client,
// kể cả sau khi update thành công.
export interface UpdateInterviewRow {
  id: string;
  title: string;
  description: string | null;
  meetingCode: string;
  allowGuest: boolean;
  maxParticipants: number;
  maxInterviewers: MaxInterviewers;
  durationMinutes: DurationMinutes;
  status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";
  enableRecording: boolean;
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
      throw new ValidationError(
        "roomPassword",
        "Mật khẩu phòng tối đa 100 ký tự",
      );
    }
    roomPassword = trimmed === "" ? null : trimmed;
  }

  // allowGuest: optional, boolean, default true
  const allowGuest = asBool(raw.allowGuest, true);

  // enableRecording: optional, boolean, default false
  const enableRecording = asBool(raw.enableRecording, false);

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
    throw new ValidationError(
      "maxInterviewers",
      "Số interviewer tối đa là bắt buộc",
    );
  }
  const mi = asInt(raw.maxInterviewers);
  if (
    mi === null ||
    !ALLOWED_MAX_INTERVIEWERS.includes(mi as MaxInterviewers)
  ) {
    throw new ValidationError(
      "maxInterviewers",
      "Số interviewer tối đa chỉ chấp nhận 2 hoặc 3",
    );
  }

  // durationMinutes: required, must be 30/60/90/120 (CHECK constraint)
  if (raw.durationMinutes === undefined || raw.durationMinutes === null) {
    throw new ValidationError(
      "durationMinutes",
      "Thời lượng phỏng vấn là bắt buộc",
    );
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
    throw new ValidationError(
      "scheduledAt",
      "scheduledAt không phải ngày hợp lệ",
    );
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
    enableRecording,
    scheduledAt: scheduled,
  };
}

/**
 * Validate payload cho PATCH /api/interviews?id=...
 * Khác với create: mọi field đều OPTIONAL, nhưng nếu có mặt thì phải hợp lệ
 * theo đúng constraint như lúc tạo. Phải có ít nhất 1 field được gửi lên.
 */
export function validateUpdateInterviewPayload(
  raw: unknown,
): UpdateInterviewInput {
  if (!isPlainObject(raw)) {
    throw new ValidationError("body", "Body phải là JSON object");
  }

  const result: UpdateInterviewInput = {};
  let hasAnyField = false;

  // title
  if (raw.title !== undefined) {
    hasAnyField = true;
    const titleRaw = asString(raw.title);
    if (titleRaw === null) {
      throw new ValidationError("title", "Tiêu đề phải là chuỗi");
    }
    const title = titleRaw.trim();
    if (title.length === 0) {
      throw new ValidationError("title", "Tiêu đề không được để trống");
    }
    if (title.length > 255) {
      throw new ValidationError("title", "Tiêu đề tối đa 255 ký tự");
    }
    result.title = title;
  }

  // description
  if (raw.description !== undefined) {
    hasAnyField = true;
    if (raw.description === null) {
      result.description = null;
    } else {
      const s = asString(raw.description);
      if (s === null) {
        throw new ValidationError("description", "Mô tả phải là chuỗi");
      }
      result.description = s.trim() === "" ? null : s.trim();
    }
  }

  // roomPassword (plain text ở tầng DTO — hash được thực hiện ở service layer,
  // giống như lúc tạo, để không lặp logic hash ở 2 nơi)
  if (raw.roomPassword !== undefined) {
    hasAnyField = true;
    if (raw.roomPassword === null) {
      result.roomPassword = null;
    } else {
      const s = asString(raw.roomPassword);
      if (s === null) {
        throw new ValidationError(
          "roomPassword",
          "Mật khẩu phòng phải là chuỗi",
        );
      }
      const trimmed = s.trim();
      if (trimmed.length > 100) {
        throw new ValidationError(
          "roomPassword",
          "Mật khẩu phòng tối đa 100 ký tự",
        );
      }
      result.roomPassword = trimmed === "" ? null : trimmed;
    }
  }

  // allowGuest
  if (raw.allowGuest !== undefined) {
    hasAnyField = true;
    if (typeof raw.allowGuest !== "boolean") {
      throw new ValidationError("allowGuest", "allowGuest phải là boolean");
    }
    result.allowGuest = raw.allowGuest;
  }

  // enableRecording
  if (raw.enableRecording !== undefined) {
    hasAnyField = true;
    if (typeof raw.enableRecording !== "boolean") {
      throw new ValidationError(
        "enableRecording",
        "enableRecording phải là boolean",
      );
    }
    result.enableRecording = raw.enableRecording;
  }

  // maxParticipants
  if (raw.maxParticipants !== undefined) {
    hasAnyField = true;
    const n = asInt(raw.maxParticipants);
    if (n === null || n < 1) {
      throw new ValidationError(
        "maxParticipants",
        "Số người tham gia tối đa phải là số nguyên >= 1",
      );
    }
    result.maxParticipants = n;
  }

  // maxInterviewers: chỉ 2 hoặc 3
  if (raw.maxInterviewers !== undefined) {
    hasAnyField = true;
    const mi = asInt(raw.maxInterviewers);
    if (
      mi === null ||
      !ALLOWED_MAX_INTERVIEWERS.includes(mi as MaxInterviewers)
    ) {
      throw new ValidationError(
        "maxInterviewers",
        "Số interviewer tối đa chỉ chấp nhận 2 hoặc 3",
      );
    }
    result.maxInterviewers = mi as MaxInterviewers;
  }

  // durationMinutes: chỉ 30/60/90/120
  if (raw.durationMinutes !== undefined) {
    hasAnyField = true;
    const dm = asInt(raw.durationMinutes);
    if (dm === null || !ALLOWED_DURATIONS.includes(dm as DurationMinutes)) {
      throw new ValidationError(
        "durationMinutes",
        "Thời lượng phỏng vấn chỉ chấp nhận 30, 60, 90 hoặc 120 phút",
      );
    }
    result.durationMinutes = dm as DurationMinutes;
  }

  // scheduledAt: phải ở tương lai
  if (raw.scheduledAt !== undefined) {
    hasAnyField = true;
    const scheduled = asDate(raw.scheduledAt);
    if (scheduled === null) {
      throw new ValidationError(
        "scheduledAt",
        "scheduledAt không phải ngày hợp lệ",
      );
    }
    if (scheduled.getTime() <= Date.now()) {
      throw new ValidationError(
        "scheduledAt",
        "scheduledAt phải ở trong tương lai",
      );
    }
    result.scheduledAt = scheduled;
  }

  if (!hasAnyField) {
    throw new ValidationError("body", "Không có trường nào để cập nhật");
  }

  return result;
}
