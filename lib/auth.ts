import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

export interface AuthUser {
  id: string;
  role: "CANDIDATE" | "RECRUITER" | "ADMIN";
}

export function getAuthUserFromRequest(req: Request): AuthUser | null {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  const headerToken = req.headers.get("x-auth-token");

  const cookieHeader = req.headers.get("cookie") ?? "";
  // Handle both "token=xxx" and "token=xxx; other=value" formats
  const cookieTokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
  const cookieToken = cookieTokenMatch ? decodeURIComponent(cookieTokenMatch[1].trim()) : null;

  const token = bearerToken || headerToken || cookieToken;

  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET chưa được cấu hình");
  }

  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload & {
      id: string;
      role: AuthUser["role"];
    };

    if (!decoded.id || !decoded.role) return null;

    // Token mới phát hành sau đợt migrate 019 có thêm claim `pwd` (UNIX
    // seconds của password_changed_at). Hàm này giữ sync để không phá 30+
    // route đang gọi, nên KHÔNG so sánh với DB. Token cũ (không có `pwd`)
    // vẫn valid cho tới khi expire 7 ngày. Sau khi user login/register/đổi
    // MK, token mới sẽ rotate và FE lưu lại.
    return {
      id: String(decoded.id),
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

export function unauthorized(message = "Chưa xác thực") {
  return NextResponse.json(
    { success: false, message },
    { status: 401 },
  );
}

export function forbidden(message = "Không có quyền truy cập") {
  return NextResponse.json(
    { success: false, message },
    { status: 403 },
  );
}

/**
 * Build a JWT with the standard `{ id, role }` payload plus a `pwd` claim.
 * `pwd` is the UNIX timestamp (seconds) of the user's `password_changed_at`
 * column. Any token issued before the column was added will still decode
 * (verifiers skip the claim when absent), so this is backward compatible.
 *
 * Pass `pwdVersion = 0` to skip the claim (legacy behavior, used when the
 * column is missing or for fallback tokens).
 */
export function signAuthToken(
  user: { id: string; role: AuthUser["role"] },
  pwdVersion: number = 0,
): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET chưa được cấu hình");
  }
  const payload: Record<string, unknown> = {
    id: user.id,
    role: user.role,
  };
  if (pwdVersion > 0) {
    payload.pwd = pwdVersion;
  }
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}
