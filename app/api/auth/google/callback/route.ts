import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { pool } from "@/lib/db";
import { signAuthToken } from "@/lib/auth";

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:3000/api/auth/google/callback",
);

export async function GET(req: Request) {
  const db = await pool.connect();

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(
        "http://localhost:3000/login?error=missing_code",
      );
    }

    // 1. exchange code -> tokens
    const { tokens } = await client.getToken(code);

    const idToken = tokens.id_token;

    if (!idToken) {
      return NextResponse.redirect(
        "http://localhost:3000/login?error=no_id_token",
      );
    }

    // 2. verify google token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      return NextResponse.redirect(
        "http://localhost:3000/login?error=invalid_google_account",
      );
    }

    const email = payload.email.toLowerCase();
    const fullName = payload.name || "";
    const avatar = payload.picture || "";

    await db.query("BEGIN");

    // 3. check user exists
    const userRes = await db.query(
      `SELECT id, email, full_name, role, password_changed_at FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );

    let user;

    if (userRes.rows.length === 0) {
      // create user
      const insertUser = await db.query(
        `
        INSERT INTO users (
          email,
          full_name,
          avatar_url,
          role,
          provider,
          password_changed_at
        )
        VALUES ($1, $2, $3, 'CANDIDATE', 'GOOGLE', NOW())
        RETURNING id, email, full_name, role, password_changed_at
        `,
        [email, fullName, avatar],
      );

      user = insertUser.rows[0];

      // create candidate profile
      await db.query(`INSERT INTO candidate_profiles (user_id) VALUES ($1)`, [
        user.id,
      ]);
    } else {
      user = userRes.rows[0];

      // update login time
      await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [
        user.id,
      ]);
    }

    await db.query("COMMIT");

    // 4. create JWT
    const token = signAuthToken(
      { id: user.id, role: user.role },
      user.password_changed_at
        ? Math.floor(new Date(user.password_changed_at).getTime() / 1000)
        : 0,
    );

    // 5. redirect to frontend success page
    const response = NextResponse.redirect(
      `http://localhost:3000/auth/success?token=${token}`,
    );
    response.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("GOOGLE CALLBACK ERROR:", err);

    return NextResponse.redirect(
      "http://localhost:3000/login?error=google_auth_failed",
    );
  } finally {
    db.release();
  }
}
