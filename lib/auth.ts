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
  const cookieTokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
  const cookieToken = cookieTokenMatch ? decodeURIComponent(cookieTokenMatch[1]) : null;

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
