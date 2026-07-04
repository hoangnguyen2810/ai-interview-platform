// API Route: /api/auth/me
//
// Returns the current authenticated user (or null when no JWT is present).
// Used by the FE to decide whether to surface recruiter-only actions
// (e.g. edit/run AI test cases).

import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = getAuthUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: { id: auth.id, role: auth.role },
  });
}