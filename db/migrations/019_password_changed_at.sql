-- Migration: 019_password_changed_at.sql
-- Created: 2026-07-25
--
-- Thêm cột password_changed_at trên users để hỗ trợ rotate JWT sau khi
-- đổi mật khẩu. Login/register/change-password ký JWT sẽ gắn claim `pwd`
-- = password_changed_at (epoch seconds) vào token. FE dùng token mới
-- trả về từ change-password để ghi đè localStorage.
--
-- Backfill: mọi user hiện tại được set = updated_at nếu có, ngược lại NOW(),
-- đảm bảo token đang lưu hành không bị restart hàng loạt.
--
-- Lưu ý: việc invalidate token cũ ở phía server (so sánh `pwd` claim với
-- DB mỗi request) cần chuyển getAuthUserFromRequest sang async và đụng
-- 30+ route hiện hữu, nằm ngoài scope cải thiện nhỏ này. Token cũ sẽ
-- tự expire sau 7 ngày theo expiresIn của JWT.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

UPDATE users
SET password_changed_at = COALESCE(updated_at, created_at, NOW())
WHERE password_changed_at IS NULL;

ALTER TABLE users
    ALTER COLUMN password_changed_at SET NOT NULL;
