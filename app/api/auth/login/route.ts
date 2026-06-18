import { pool } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email và mật khẩu là bắt buộc",
        },
        { status: 400 },
      );
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET chưa được cấu hình");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `
      SELECT
        id,
        email,
        full_name,
        password_hash,
        role,
        is_active
      FROM users
      WHERE email = $1
      AND deleted_at IS NULL
      `,
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Email hoặc mật khẩu không đúng",
        },
        { status: 401 },
      );
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return NextResponse.json(
        {
          success: false,
          message: "Tài khoản đã bị khóa",
        },
        { status: 403 },
      );
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return NextResponse.json(
        {
          success: false,
          message: "Email hoặc mật khẩu không đúng",
        },
        { status: 401 },
      );
    }

    // Cập nhật thời điểm đăng nhập gần nhất
    await pool.query(
      `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [user.id],
    );

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi server",
      },
      {
        status: 500,
      },
    );
  }
}
