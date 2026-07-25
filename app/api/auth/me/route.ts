// API Route: /api/auth/me
//
// Returns the current authenticated user (or null when no JWT is present).
// Used by the FE to decide whether to surface recruiter-only actions
// (e.g. edit/run AI test cases), and by HeroSection to greet the user.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = getAuthUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ user: null });
  }

  // Lấy thông tin cơ bản của user để render UI (Hero greeting, profile…).
  // Không trả password_hash.
  const result = await pool.query<{
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
    provider: string;
  }>(
    `SELECT id, email, full_name, avatar_url, role, provider
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [auth.id],
  );

  const row = result.rows[0];
  if (!row) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      role: row.role,
      provider: row.provider,
    },
  });
}
