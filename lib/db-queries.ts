import { pool } from "@/lib/db";

/**
 * Đếm record an toàn – nếu bảng chưa tồn tại trong DB thì trả về 0
 * thay vì throw `relation "xxx" does not exist`. Dùng `to_regclass` để
 * kiểm tra schema trước khi truy vấn.
 *
 * @param tableName  tên bảng đã quote sẵn nếu cần (vd: "jobs")
 * @param whereSql   mệnh đề WHERE (không bao gồm từ khoá WHERE).
 *                   Phải chứa placeholder theo thứ tự $1, $2, ... tương ứng với args.
 * @param args       tham số truyền cho WHERE
 */
export async function safeCount(
  tableName: string,
  whereSql: string,
  args: unknown[] = [],
): Promise<number> {
  try {
    const exists = await pool.query(
      `SELECT to_regclass($1) IS NOT NULL AS ok`,
      [tableName],
    );

    if (!exists.rows[0]?.ok) return 0;

    const sql = whereSql.trim()
      ? `SELECT COUNT(*)::int AS c FROM ${tableName} WHERE ${whereSql}`
      : `SELECT COUNT(*)::int AS c FROM ${tableName}`;

    const result = await pool.query(sql, args);
    return result.rows[0]?.c ?? 0;
  } catch (error) {
    // Không bao giờ để lỗi stats làm vỡ cả response /api/.../profile
    console.error(`safeCount(${tableName}) failed:`, error);
    return 0;
  }
}

export async function safeCountApplications(
  whereSql = "candidate_id = $1",
  args: unknown[] = [],
): Promise<number> {
  return safeCount("applications", whereSql, args);
}

export async function safeCountInterviews(
  whereSql = "1=1",
  args: unknown[] = [],
): Promise<number> {
  return safeCount("interviews", whereSql, args);
}

export async function safeCountSavedJobs(
  whereSql = "1=1",
  args: unknown[] = [],
): Promise<number> {
  return safeCount("saved_jobs", whereSql, args);
}
