import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { pool } from "@/lib/db";
import jwt from "jsonwebtoken";

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:3000/api/auth/google/callback",
);

export async function GET(req: Request) {
  const db = await pool.connect();

  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    // exchange code → tokens
    const { tokens } = await client.getToken(code);

    const idToken = tokens.id_token;

    if (!idToken) {
      throw new Error("No id_token from Google");
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      throw new Error("Invalid Google account");
    }

    const email = payload.email.toLowerCase();
    const fullName = payload.name;
    const avatar = payload.picture;

    await db.query("BEGIN");

    // check user
    const userRes = await db.query(
      `SELECT * FROM users WHERE email=$1 AND deleted_at IS NULL`,
      [email],
    );

    let user;

    if (userRes.rows.length === 0) {
      const insert = await db.query(
        `INSERT INTO users (email, full_name, avatar_url, role, provider)
         VALUES ($1,$2,$3,'CANDIDATE','GOOGLE')
         RETURNING id,email,full_name,role`,
        [email, fullName, avatar],
      );

      user = insert.rows[0];

      await db.query(`INSERT INTO candidate_profiles (user_id) VALUES ($1)`, [
        user.id,
      ]);
    } else {
      user = userRes.rows[0];

      await db.query(`UPDATE users SET last_login_at = NOW() WHERE id=$1`, [
        user.id,
      ]);
    }

    await db.query("COMMIT");

    // JWT
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" },
    );

    // redirect về frontend kèm token
    const redirectUrl =
      `http://localhost:3000/auth/success` + `?token=${token}`;

    const response = NextResponse.redirect(redirectUrl);
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
    console.error(err);

    return NextResponse.redirect(
      "http://localhost:3000/login?error=google_auth_failed",
    );
  } finally {
    db.release();
  }
}
