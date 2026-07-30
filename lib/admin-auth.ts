// Shared helpers cho /api/admin/* route handlers.
//
//   - requireAdmin(req) → AuthUser | Response (gọi xong trả về auth hoặc return Response)
//   - parsePagination(url) → { page, limit, offset } (clamp page>=1, 1<=limit<=100)
//   - parseSearch(url) → search text
//   - ok(data, init?) / err(message, status) giúp chuẩn hoá response.

import { NextResponse } from "next/server";
import {
  getAuthUserFromRequest,
  type AuthUser,
  forbidden,
  unauthorized,
} from "@/lib/auth";

export function requireAdmin(req: Request): AuthUser | NextResponse {
  const auth = getAuthUserFromRequest(req);
  if (!auth) return unauthorized();
  if (auth.role !== "ADMIN") return forbidden("Chỉ ADMIN mới có quyền");
  return auth;
}

export function parsePagination(url: string) {
  const u = new URL(url);
  const page = Math.max(1, parseInt(u.searchParams.get("page") || "1", 10) || 1);
  const rawLimit = parseInt(u.searchParams.get("limit") || "20", 10) || 20;
  const limit = Math.min(100, Math.max(1, rawLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export function parseSearch(url: string) {
  const u = new URL(url);
  return (u.searchParams.get("q") || "").trim();
}

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ success: true, ...((data as object) || {}) }, init);
}

export function err(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

/**
 * Build WHERE clause cho soft-delete.
 * Trả về "" nếu cột không tồn tại hoặc bảng đã filter ở caller.
 */
export const NOT_DELETED = (col = "deleted_at") =>
  ` AND ${col} IS NULL`;

export function getTokenHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
