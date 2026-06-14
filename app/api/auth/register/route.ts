import { pool } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

function isStrongPassword(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  const client = await pool.connect();

  try {
    const body = await req.json();

    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim();
    const password = body.password;
    const role = body.role;

    // Validate required fields
    if (!email || !password || !fullName || !role) {
      return NextResponse.json(
        {
          success: false,
          message: "Vui lòng nhập đầy đủ thông tin",
        },
        { status: 400 },
      );
    }

    // Validate role
    if (!["CANDIDATE", "RECRUITER"].includes(role)) {
      return NextResponse.json(
        {
          success: false,
          message: "Role không hợp lệ",
        },
        { status: 400 },
      );
    }

    // Validate email
    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Email không hợp lệ",
        },
        { status: 400 },
      );
    }

    // Validate password
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt",
        },
        { status: 400 },
      );
    }

    // Check email tồn tại
    const existingUser = await client.query(
      `
      SELECT id
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email],
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Email đã tồn tại",
        },
        { status: 409 },
      );
    }

    await client.query("BEGIN");

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userResult = await client.query(
      `
      INSERT INTO users (
        email,
        password_hash,
        full_name,
        role
      )
      VALUES ($1,$2,$3,$4)
      RETURNING
        id,
        email,
        full_name,
        role,
        created_at
      `,
      [email, passwordHash, fullName, role],
    );

    const user = userResult.rows[0];

    if (!user) {
      throw new Error("Không thể tạo tài khoản");
    }

    // Create profile
    if (role === "CANDIDATE") {
      await client.query(
        `
        INSERT INTO candidate_profiles (
          user_id
        )
        VALUES ($1)
        `,
        [user.id],
      );
    }

    if (role === "RECRUITER") {
      await client.query(
        `
        INSERT INTO recruiter_profiles (
          user_id
        )
        VALUES ($1)
        `,
        [user.id],
      );
    }

    await client.query("COMMIT");

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET chưa được cấu hình");
    }

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

    return NextResponse.json(
      {
        success: true,
        message: "Đăng ký thành công",
        token,
        user,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error("REGISTER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      {
        status: 500,
      },
    );
  } finally {
    client.release();
  }
}
