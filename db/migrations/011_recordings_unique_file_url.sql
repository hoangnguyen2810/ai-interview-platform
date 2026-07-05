-- Migration: Add UNIQUE constraint on recordings.file_url
-- Created: 2026-07-05
--
-- Lý do:
--   API POST /api/interviews/[meetingCode]/recordings dùng
--   `ON CONFLICT (file_url) DO UPDATE` để idempotent — nhưng
--   bảng `recordings` ban đầu không có UNIQUE constraint trên file_url,
--   dẫn đến PostgreSQL lỗi:
--     `there is no unique or exclusion constraint matching the ON CONFLICT specification`
--   và trả 500.
--
-- Migration này:
--   1. Dọn duplicate (nếu có) trước khi thêm constraint — chỉ giữ row MỚI NHẤT.
--   2. Thêm UNIQUE constraint.
--   3. Bổ sung partial unique index cho soft-delete (deleted_at IS NULL)
--      để idempotent vẫn hoạt động đúng sau khi record bị xoá mềm.

-- 1. Dọn duplicate: giữ row có created_at mới nhất cho mỗi file_url
DELETE FROM recordings a
USING recordings b
WHERE a.id < b.id
  AND a.file_url = b.file_url
  AND a.deleted_at IS NULL
  AND b.deleted_at IS NULL;

-- 2. Thêm UNIQUE constraint cho file_url (chỉ áp dụng cho rows chưa bị xoá mềm)
--    Dùng partial unique index thay vì constraint trực tiếp để tránh conflict
--    với soft-delete rows cũ (sau này restore lại cùng URL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_recordings_file_url
    ON recordings(file_url)
    WHERE deleted_at IS NULL;