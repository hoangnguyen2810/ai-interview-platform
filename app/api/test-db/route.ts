import { Pool } from "pg";

export const runtime = "nodejs";

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
});

export async function GET() {
  try {
    const result = await pool.query("SELECT NOW()");

    return Response.json({
      success: true,
      message: "Kết nối OK",
      time: result.rows[0],
    });
  } catch (err) {
    return Response.json(
      {
        success: false,
        message: "Kết nối thất bại",
        error: String(err),
      },
      { status: 500 },
    );
  }
}
