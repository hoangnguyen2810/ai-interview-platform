import { pool } from "@/lib/db";
import { forbidden, getAuthUserFromRequest, unauthorized } from "@/lib/auth";
import {
  safeCountApplications,
  safeCountInterviews,
  safeCountSavedJobs,
} from "@/lib/db-queries";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PHONE_RE = /^[+0-9\s().-]{6,20}$/;

function cleanString(value: unknown, max = 500): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function toIntOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function calcCandidateCompletion(fields: {
  phone: string | null;
  avatar_url: string | null;
  cv_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  experience_years: number | null;
}): number {
  const checks = [
    !!fields.phone,
    !!fields.avatar_url,
    !!fields.cv_url,
    !!fields.github_url,
    !!fields.linkedin_url,
    typeof fields.experience_years === "number" && fields.experience_years > 0,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

export async function GET(req: Request) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();
    if (auth.role !== "CANDIDATE") {
      return forbidden("Chỉ tài khoản Candidate mới truy cập được");
    }

    const result = await pool.query(
      `
      SELECT
        u.id            AS user_id,
        u.email,
        u.full_name,
        u.role,
        u.avatar_url    AS user_avatar_url,
        u.is_active,
        u.created_at,
        u.updated_at,
        u.last_login_at,
        cp.phone,
        cp.github_url,
        cp.linkedin_url,
        cp.cv_url,
        cp.experience_years
      FROM users u
      LEFT JOIN candidate_profiles cp ON cp.user_id = u.id
      WHERE u.id = $1
        AND u.deleted_at IS NULL
      LIMIT 1
      `,
      [auth.id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy người dùng" },
        { status: 404 },
      );
    }

    const row = result.rows[0];

    // Stats: mỗi nguồi chạy độc lập + an toàn – nếu bảng chưa tồn tại,
    // safeCount* trả về 0, response vẫn trả 200.
    const [totalApplications, totalInterviews, offersReceived, savedJobs] =
      await Promise.all([
        safeCountApplications("candidate_id = $1", [auth.id]),
        safeCountInterviews("candidate_id = $1", [auth.id]),
        safeCountApplications("candidate_id = $1 AND status = 'OFFER'", [
          auth.id,
        ]),
        safeCountSavedJobs("candidate_id = $1", [auth.id]),
      ]);

    const hasPhone = !!row.phone;
    const hasGithub = !!row.github_url;
    const hasLinkedin = !!row.linkedin_url;
    const hasCv = !!row.cv_url;

    const profile = {
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      joinedAt: row.created_at,
      lastLoginAt: row.last_login_at,
      avatarUrl: row.user_avatar_url ?? "",
      phone: row.phone ?? "",
      cvUrl: row.cv_url ?? "",
      githubUrl: row.github_url ?? "",
      linkedinUrl: row.linkedin_url ?? "",
      experienceYears: row.experience_years ?? 0,
      status: {
        phone: hasPhone,
        github: hasGithub,
        linkedin: hasLinkedin,
        cv: hasCv,
      },
    };

    const stats = {
      totalApplications,
      totalInterviews,
      offersReceived,
      savedJobs,
    };

    return NextResponse.json({ success: true, profile, stats });
  } catch (error) {
    console.error("GET CANDIDATE PROFILE ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const client = await pool.connect();
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();
    if (auth.role !== "CANDIDATE") {
      return forbidden("Chỉ tài khoản Candidate mới được cập nhật");
    }

    const body = await req.json().catch(() => ({}));

    const phone = cleanString(body.phone, 20);
    if (phone && !PHONE_RE.test(phone)) {
      return NextResponse.json(
        { success: false, message: "Số điện thoại không hợp lệ" },
        { status: 400 },
      );
    }

    const experienceYears = toIntOrNull(body.experienceYears);
    if (
      experienceYears !== null &&
      (experienceYears < 0 || experienceYears > 70)
    ) {
      return NextResponse.json(
        { success: false, message: "Số năm kinh nghiệm không hợp lệ" },
        { status: 400 },
      );
    }

    const cvUrl = cleanString(body.cvUrl);
    const githubUrl = cleanString(body.githubUrl);
    const linkedinUrl = cleanString(body.linkedinUrl);
    const fullName = cleanString(body.fullName, 255);
    const avatarUrl = cleanString(body.avatarUrl);

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT user_id FROM candidate_profiles WHERE user_id = $1 LIMIT 1`,
      [auth.id],
    );
    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO candidate_profiles (user_id) VALUES ($1)`,
        [auth.id],
      );
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    let i = 1;

    if (body.phone !== undefined) {
      updates.push(`phone = $${i++}`);
      params.push(phone);
    }
    if (body.githubUrl !== undefined) {
      updates.push(`github_url = $${i++}`);
      params.push(githubUrl);
    }
    if (body.linkedinUrl !== undefined) {
      updates.push(`linkedin_url = $${i++}`);
      params.push(linkedinUrl);
    }
    if (body.cvUrl !== undefined) {
      updates.push(`cv_url = $${i++}`);
      params.push(cvUrl);
    }
    if (body.experienceYears !== undefined) {
      updates.push(`experience_years = $${i++}`);
      params.push(experienceYears);
    }

    const currentRow = await client.query(
      `SELECT phone, github_url, linkedin_url, cv_url, experience_years
       FROM candidate_profiles WHERE user_id = $1`,
      [auth.id],
    );
    const cur = currentRow.rows[0] ?? {};

    const userRow = await client.query(
      `SELECT avatar_url FROM users WHERE id = $1`,
      [auth.id],
    );
    const userCurAvatar = userRow.rows[0]?.avatar_url ?? null;

    const merged = {
      phone: phone ?? cur.phone ?? null,
      avatar_url: avatarUrl ?? userCurAvatar ?? null,
      cv_url: cvUrl ?? cur.cv_url ?? null,
      github_url: githubUrl ?? cur.github_url ?? null,
      linkedin_url: linkedinUrl ?? cur.linkedin_url ?? null,
      experience_years:
        experienceYears !== null
          ? experienceYears
          : (cur.experience_years ?? null),
    };
    const completion = calcCandidateCompletion(merged);

    if (updates.length > 0) {
      await client.query(
        `UPDATE candidate_profiles
            SET ${updates.join(", ")}
          WHERE user_id = $${i}`,
        [...params, auth.id],
      );
    }

    if (fullName || avatarUrl !== null) {
      const userSets: string[] = [];
      const userParams: (string | null)[] = [];
      let j = 1;
      if (fullName) {
        userSets.push(`full_name = $${j++}`);
        userParams.push(fullName);
      }
      if (body.avatarUrl !== undefined) {
        userSets.push(`avatar_url = $${j++}`);
        userParams.push(avatarUrl);
      }
      userSets.push("updated_at = CURRENT_TIMESTAMP");
      await client.query(
        `UPDATE users SET ${userSets.join(", ")} WHERE id = $${j}`,
        [...userParams, auth.id],
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Cập nhật hồ sơ thành công",
      profileCompletion: completion,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("PUT CANDIDATE PROFILE ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
