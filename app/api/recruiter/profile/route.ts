import { pool } from "@/lib/db";
import { forbidden, getAuthUserFromRequest, unauthorized } from "@/lib/auth";
import {
  safeCountApplications,
  safeCountInterviews,
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

function calcRecruiterCompletion(fields: {
  company_name: string | null;
  company_website: string | null;
  company_description: string | null;
  company_logo: string | null;
  position: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  cover_image_url: string | null;
}): number {
  const checks = [
    !!fields.company_name,
    !!fields.company_website,
    !!fields.company_description,
    !!fields.company_logo,
    !!fields.position,
    !!fields.phone,
    !!fields.bio,
    !!fields.avatar_url,
    !!fields.linkedin_url,
    !!fields.cover_image_url,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

export async function GET(req: Request) {
  try {
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();
    if (auth.role !== "RECRUITER") {
      return forbidden("Chỉ tài khoản Recruiter mới truy cập được");
    }

    const result = await pool.query(
      `
      SELECT
        u.id           AS user_id,
        u.email,
        u.full_name,
        u.role,
        u.avatar_url   AS user_avatar_url,
        u.is_active,
        u.created_at,
        u.updated_at,
        u.last_login_at,
        rp.id          AS recruiter_profile_id,
        rp.company_id,
        rp.position,
        rp.phone,
        rp.bio,
        rp.linkedin_url,
        rp.cover_image_url,
        c.company_name,
        c.website      AS company_website,
        c.logo_url     AS company_logo_url,
        c.description  AS company_description
      FROM users u
      LEFT JOIN recruiter_profiles rp ON rp.user_id = u.id
      LEFT JOIN companies c ON c.id = rp.company_id
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

    // ---------- Stats ----------
    // Từng truy vấn độc lập + an toàn – nếu bảng chưa tồn tại,
    // safeCount* trả về 0 thay vì ném lỗi `relation "..." does not exist`.
    const [openJobs, applications, aiInterviews, hired] = await Promise.all([
      // openJobs cần filter theo status='OPEN' nên phải dùng custom try/catch
      (async () => {
        try {
          const exists = await pool.query(
            `SELECT to_regclass('jobs') IS NOT NULL AS ok`,
          );
          if (!exists.rows[0]?.ok) return 0;
          const r = await pool.query(
            `SELECT COUNT(*)::int AS c
               FROM jobs
              WHERE recruiter_id = $1
                AND status = 'OPEN'`,
            [auth.id],
          );
          return r.rows[0]?.c ?? 0;
        } catch (e) {
          console.error("count open jobs failed:", e);
          return 0;
        }
      })(),
      safeCountApplications("candidate_id = $1", [auth.id]),
      safeCountInterviews("candidate_id = $1", [auth.id]),
      safeCountApplications("status = 'HIRED' AND candidate_id = $1", [
        auth.id,
      ]),
    ]);

    const stats = { openJobs, applications, aiInterviews, hired };

    // ---------- Activities (best-effort) ----------
    // Mỗi nguồn chạy trong try/catch riêng – nếu bảng jobs/applications
    // chưa migrate, phần còn lại vẫn hiển thị được.
    const activities: { type: string; text: string; at: string }[] = [];

    try {
      const jobExists = await pool.query(
        `SELECT to_regclass('jobs') IS NOT NULL AS ok`,
      );
      if (jobExists.rows[0]?.ok) {
        const r = await pool.query(
          `SELECT 'JOB_CREATED' AS type, title AS text, created_at AS at
             FROM jobs
            WHERE recruiter_id = $1
            ORDER BY created_at DESC
            LIMIT 10`,
          [auth.id],
        );
        r.rows.forEach((row) =>
          activities.push({ type: row.type, text: row.text, at: row.at }),
        );
      }
    } catch (e) {
      console.error("activities: jobs failed:", e);
    }

    try {
      const interviewExists = await pool.query(
        `SELECT to_regclass('interviews') IS NOT NULL AS ok`,
      );
      if (interviewExists.rows[0]?.ok) {
        const r = await pool.query(
          `SELECT 'INTERVIEW_CREATED' AS type,
                  'Created interview room #' || i.id::text AS text,
                  i.created_at AS at
             FROM interviews i
            ORDER BY i.created_at DESC
            LIMIT 10`,
        );
        r.rows.forEach((row) =>
          activities.push({ type: row.type, text: row.text, at: row.at }),
        );
      }
    } catch (e) {
      console.error("activities: interviews failed:", e);
    }

    try {
      const evalExists = await pool.query(
        `SELECT to_regclass('evaluations') IS NOT NULL AS ok`,
      );
      const appExists = await pool.query(
        `SELECT to_regclass('applications') IS NOT NULL AS ok`,
      );
      const usersExists = await pool.query(
        `SELECT to_regclass('users') IS NOT NULL AS ok`,
      );
      if (evalExists.rows[0]?.ok && appExists.rows[0]?.ok && usersExists.rows[0]?.ok) {
        const r = await pool.query(
          `SELECT 'EVALUATION' AS type,
                  'Evaluated candidate ' || COALESCE(c.full_name, 'Unknown') AS text,
                  e.created_at AS at
             FROM evaluations e
             JOIN applications a ON a.id = e.application_id
             LEFT JOIN users c ON c.id = a.candidate_id
            ORDER BY e.created_at DESC
            LIMIT 10`,
        );
        r.rows.forEach((row) =>
          activities.push({ type: row.type, text: row.text, at: row.at }),
        );
      }
    } catch (e) {
      console.error("activities: evaluations failed:", e);
    }

    activities.sort(
      (a, b) =>
        new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
    activities.splice(10);

    const profile = {
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      joinedAt: row.created_at,
      lastLoginAt: row.last_login_at,
      avatarUrl: row.user_avatar_url ?? "",
      coverImageUrl: row.cover_image_url ?? "",
      position: row.position ?? "",
      phone: row.phone ?? "",
      bio: row.bio ?? "",
      linkedinUrl: row.linkedin_url ?? "",
      companyId: row.company_id ?? null,
      company: {
        name: row.company_name ?? "",
        website: row.company_website ?? "",
        logoUrl: row.company_logo_url ?? "",
        description: row.company_description ?? "",
      },
    };

    return NextResponse.json({
      success: true,
      profile,
      stats,
      activities,
    });
  } catch (error) {
    console.error("GET RECRUITER PROFILE ERROR:", error);
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
    if (auth.role !== "RECRUITER") {
      return forbidden("Chỉ tài khoản Recruiter mới được cập nhật");
    }

    const body = await req.json().catch(() => ({}));

    const phone = cleanString(body.phone, 20);
    if (phone && !PHONE_RE.test(phone)) {
      return NextResponse.json(
        { success: false, message: "Số điện thoại không hợp lệ" },
        { status: 400 },
      );
    }

    const position = cleanString(body.position, 100);
    const bio = cleanString(body.bio, 2000);
    const linkedinUrl = cleanString(body.linkedinUrl);
    const coverImageUrl = cleanString(body.coverImageUrl);

    const companyName = cleanString(body.companyName, 255);
    const companyWebsite = cleanString(body.companyWebsite);
    const companyLogoUrl = cleanString(body.companyLogoUrl);
    const companyDescription = cleanString(body.companyDescription, 2000);

    const fullName = cleanString(body.fullName, 255);
    const avatarUrl = cleanString(body.avatarUrl);

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id, company_id FROM recruiter_profiles WHERE user_id = $1 LIMIT 1`,
      [auth.id],
    );

    let companyId: string | null =
      existing.rows[0]?.company_id ?? null;

    const hasCompanyPayload =
      body.companyName !== undefined ||
      body.companyWebsite !== undefined ||
      body.companyLogoUrl !== undefined ||
      body.companyDescription !== undefined;

    if (hasCompanyPayload) {
      if (companyId) {
        const sets: string[] = [];
        const params: (string | null)[] = [];
        let i = 1;
        if (body.companyName !== undefined) {
          sets.push(`company_name = $${i++}`);
          params.push(companyName);
        }
        if (body.companyWebsite !== undefined) {
          sets.push(`website = $${i++}`);
          params.push(companyWebsite);
        }
        if (body.companyLogoUrl !== undefined) {
          sets.push(`logo_url = $${i++}`);
          params.push(companyLogoUrl);
        }
        if (body.companyDescription !== undefined) {
          sets.push(`description = $${i++}`);
          params.push(companyDescription);
        }
        if (sets.length > 0) {
          await client.query(
            `UPDATE companies SET ${sets.join(", ")} WHERE id = $${i}`,
            [...params, companyId],
          );
        }
      } else {
        const insertResult = await client.query(
          `INSERT INTO companies (company_name, website, logo_url, description, created_by)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            companyName,
            companyWebsite,
            companyLogoUrl,
            companyDescription,
            auth.id,
          ],
        );
        companyId = insertResult.rows[0]?.id ?? null;
      }
    }

    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO recruiter_profiles (user_id, company_id) VALUES ($1, $2)`,
        [auth.id, companyId],
      );
    } else if (companyId && existing.rows[0].company_id !== companyId) {
      await client.query(
        `UPDATE recruiter_profiles SET company_id = $1 WHERE user_id = $2`,
        [companyId, auth.id],
      );
    }

    const profileSets: string[] = [];
    const profileParams: (string | null)[] = [];
    let pi = 1;
    if (body.position !== undefined) {
      profileSets.push(`position = $${pi++}`);
      profileParams.push(position);
    }
    if (body.phone !== undefined) {
      profileSets.push(`phone = $${pi++}`);
      profileParams.push(phone);
    }
    if (body.bio !== undefined) {
      profileSets.push(`bio = $${pi++}`);
      profileParams.push(bio);
    }
    if (body.linkedinUrl !== undefined) {
      profileSets.push(`linkedin_url = $${pi++}`);
      profileParams.push(linkedinUrl);
    }
    if (body.coverImageUrl !== undefined) {
      profileSets.push(`cover_image_url = $${pi++}`);
      profileParams.push(coverImageUrl);
    }

    if (profileSets.length > 0) {
      await client.query(
        `UPDATE recruiter_profiles
            SET ${profileSets.join(", ")}
          WHERE user_id = $${pi}`,
        [...profileParams, auth.id],
      );
    }

    if (fullName || body.avatarUrl !== undefined) {
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

    const mergedRow = await client.query(
      `
      SELECT
        u.avatar_url        AS avatar_url,
        rp.cover_image_url  AS cover_image_url,
        rp.position         AS position,
        rp.phone            AS phone,
        rp.bio              AS bio,
        rp.linkedin_url     AS linkedin_url,
        c.company_name      AS company_name,
        c.website           AS company_website,
        c.logo_url          AS company_logo,
        c.description       AS company_description
      FROM users u
      LEFT JOIN recruiter_profiles rp ON rp.user_id = u.id
      LEFT JOIN companies c ON c.id = rp.company_id
      WHERE u.id = $1
      `,
      [auth.id],
    );
    const m = mergedRow.rows[0] ?? {};
    const completion = calcRecruiterCompletion({
      company_name: m.company_name ?? null,
      company_website: m.company_website ?? null,
      company_description: m.company_description ?? null,
      company_logo: m.company_logo ?? null,
      position: m.position ?? null,
      phone: m.phone ?? null,
      bio: m.bio ?? null,
      avatar_url: m.avatar_url ?? null,
      linkedin_url: m.linkedin_url ?? null,
      cover_image_url: m.cover_image_url ?? null,
    });

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
    console.error("PUT RECRUITER PROFILE ERROR:", error);
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
