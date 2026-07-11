-- Migration: add interview_id + interview_title to recordings
-- Created: 2026-07-11
--
-- Lý do: UI recruiter cần hiển thị TÊN buổi phỏng vấn ngay trong table
-- recordings — không phải chỉ meetingCode. Trước đây chỉ lưu call_cid +
-- url + filename → mỗi lần hiển thị phải JOIN interviews theo meeting_code
-- hoặc lookup server.
--
-- Quyết định thiết kế:
--   1. Thêm `interview_id` UUID NULL trước (back-fill an toàn, không lock
--      table cho rows cũ không match được vì meeting_code đã đổi).
--   2. Thêm `interview_title` VARCHAR(255) NULL — lưu SNAPSHOT title tại
--      thời điểm recording. Lý do: nếu user đổi title interview sau này,
--      recording cũ vẫn hiển thị title gốc → không bị "lịch sử xáo trộn".
--      Tương tự cách các CMS lưu author_name snapshot.
--   3. Back-fill từ bảng `interviews` theo meeting_code (JOIN cột `call_cid`
--      parse ra meeting_code; hoặc parse trong SQL).
--   4. Add FK constraint sau khi back-fill xong (interview_id nullable
--      trong giai đoạn transition; ON DELETE SET NULL cho an toàn).
--
-- Lưu ý:
--   - `interview_title` KHÔNG phải denormalized join — đây là intentional
--     snapshot. Khi interview bị xoá, FK ON DELETE SET NULL sẽ null
--     interview_id nhưng giữ interview_title cũ.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. ADD COLUMN nullable trước (back-fill an toàn).
ALTER TABLE recordings
    ADD COLUMN IF NOT EXISTS interview_id UUID
        REFERENCES interviews(id)
        ON DELETE SET NULL;

ALTER TABLE recordings
    ADD COLUMN IF NOT EXISTS interview_title VARCHAR(255);

-- 2. Back-fill từ interviews theo meeting_code.
--
--    call_cid format: "<callType>:<meetingCode>", vd "default:NC-23G6KRA3".
--    meeting_code UNIQUE trong interviews → 1 mapping duy nhất.
--
--    split_part(call_cid, ':', 2) trả meeting_code. Nếu call_cid không có
--    ":" → split_part trả NULL → an toàn (không match).
UPDATE recordings r
SET
    interview_id = i.id,
    interview_title = i.title
FROM interviews i
WHERE r.interview_id IS NULL
  AND split_part(r.call_cid, ':', 2) = i.meeting_code
  AND i.deleted_at IS NULL;

-- 3. Index cho query theo interview_id (UI filter "theo buổi phỏng vấn").
CREATE INDEX IF NOT EXISTS idx_recordings_interview_id
    ON recordings(interview_id)
    WHERE interview_id IS NOT NULL;

-- 4. Index cho tìm kiếm theo title (UI search).
CREATE INDEX IF NOT EXISTS idx_recordings_interview_title
    ON recordings(interview_title)
    WHERE interview_title IS NOT NULL;