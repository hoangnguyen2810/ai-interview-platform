// Cookie-based "password gate" cho Interview.
//
// Khi user (INTERVIEWER hoặc CANDIDATE) nhập đúng password phòng phỏng vấn,
// ta set cookie `interview_pwd_<interviewId>` = "1" để đánh dấu đã verify.
//
// - HttpOnly: cookie không bộc lộ cho JS
// - SameSite=Lax, Path=/: browser gửi lại khi navigate cùng site
// - Max-age: 8h (đủ cho 1 phiên phỏng vấn)
// - Scope: theo `interviewId` → mỗi phòng có cookie riêng
//
// HOST không cần cookie (được bypass qua guard).
//
// Lưu ý: cookie không chứa password, chỉ là flag "đã verify".

import { cookies } from "next/headers";

const GATE_PREFIX = "interview_pwd_";
const GATE_MAX_AGE_SECONDS = 60 * 60 * 8; // 8h

export function gateCookieName(interviewId: string): string {
  return `${GATE_PREFIX}${interviewId}`;
}

/**
 * Đọc cookie gate cho 1 interview (server-side).
 * Trả về true nếu user đã verify password cho phòng này trong session.
 */
export async function isPasswordGatePassed(
  interviewId: string,
): Promise<boolean> {
  const cookieStore = await cookies();
  const v = cookieStore.get(gateCookieName(interviewId))?.value;
  return v === "1";
}

/**
 * Append `Set-Cookie` header vào response gốc.
 * Phải dùng `res.headers.append` trực tiếp (không tạo Headers mới)
 * vì Response.headers đã là Headers instance — clone sẽ làm mất tham chiếu.
 */
export function setPasswordGateCookie(
  res: Response,
  interviewId: string,
): void {
  const name = gateCookieName(interviewId);
  const parts = [
    `${name}=1`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${GATE_MAX_AGE_SECONDS}`,
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  res.headers.append("Set-Cookie", parts.join("; "));
}