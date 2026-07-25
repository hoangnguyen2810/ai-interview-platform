import { pool } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getAuthUserFromRequest, unauthorized, signAuthToken } from "@/lib/auth";

function isStrongPassword(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export async function POST(req: Request) {
  const auth = getAuthUserFromRequest(req);
  if (!auth) return unauthorized();

  const client = await pool.connect();

  try {
    const body = await req.json();
    const oldPassword = body.oldPassword;
    const newPassword = body.newPassword;

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới",
        },
        { status: 400 },
      );
    }

    if (!isStrongPassword(newPassword)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt",
        },
        { status: 400 },
      );
    }

    const userResult = await client.query(
      `
      SELECT password_hash, provider, role
      FROM users
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1
      `,
      [auth.id],
    );

    const user = userResult.rows[0];
    if (!user) return unauthorized();

    if (user.provider !== "LOCAL" || !user.password_hash) {
      return NextResponse.json(
        {
          success: false,
          message: "Tài khoản này đăng nhập qua Google, không thể đổi mật khẩu",
        },
        { status: 400 },
      );
    }

    const match = await bcrypt.compare(oldPassword, user.password_hash);
    if (!match) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu cũ không đúng" },
        { status: 400 },
      );
    }

    const sameAsOld = await bcrypt.compare(newPassword, user.password_hash);
    if (sameAsOld) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu mới phải khác mật khẩu cũ" },
        { status: 400 },
      );
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    // Cập nhật password_hash + password_changed_at trong cùng transaction
    // để có timestamp nhất quán cho token mới.
    const updateRes = await client.query(
      `
      UPDATE users
      SET password_hash = $1,
          password_changed_at = NOW(),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING password_changed_at
      `,
      [newHash, auth.id],
    );

    const newPwdAt = updateRes.rows[0]?.password_changed_at;
    const newPwdVersion = newPwdAt
      ? Math.floor(new Date(newPwdAt).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    // Cấp token mới kèm `pwd` claim mới nhất. Token cũ (không có `pwd` hoặc
    // `pwd` cũ hơn) sẽ bị huỷ hiệu lực vì các route đăng nhập mới sẽ so
    // sánh claim với DB.
    const newToken = signAuthToken(
      { id: auth.id, role: auth.role },
      newPwdVersion,
    );

    return NextResponse.json({
      success: true,
      message: "Đổi mật khẩu thành công",
      token: newToken,
    });
  } catch (error) {
    console.error("CHANGE_PASSWORD ERROR:", error);

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
