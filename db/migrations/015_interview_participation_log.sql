-- Migration: interview_participation_log (append-only history)
-- Created: 2026-07-12
--
-- Bối cảnh:
--   Bảng `interview_candidates` đang giữ 1 row UNIQUE theo interview_id
--   (đại diện "slot hiện tại"). Khi candidate A out rồi candidate B vào
--   sau (cơ chế takeover ở lib/interview-guard.ts attachCandidate CASE 3),
--   code UPDATE row cùng id → đổi user_id, refresh joined_at.
--
--   Hậu quả: candidate A mất hoàn toàn lịch sử tham gia — chỉ B (cuối
--   cùng) hiện trong bảng. UI dashboard candidate không thấy buổi A đã
--   từng vào.
--
-- Giải pháp:
--   Bảng `interview_participation_log` lưu append-only mỗi lượt candidate
--   chiếm slot. INSERT 1 row cho mỗi CASE trong attachCandidate (CASE 1
--   refresh tạo log mới, CASE 2/3/4 tạo row đầu tiên). Cập nhật left_at
--   khi candidate leave (presence route action=leave).
--
-- Schema:
--   - id            : UUID
--   - interview_id  : FK interviews (CASCADE delete)
--   - user_id       : FK users (SET NULL nếu user bị xoá — vẫn giữ log)
--   - candidate_name: snapshot tên lúc join (phòng user đổi tên sau)
--   - joined_at     : thời điểm vào slot
--   - left_at       : thời điểm out (NULL = đang trong phòng hoặc crash)
--   - end_reason    : 'LEFT_NORMAL' | 'TAKEN_OVER' | 'CRASH' | NULL
--   - created_at    : metadata
--
-- Lưu ý:
--   - KHÔNG có UNIQUE constraint — append-only, có thể nhiều row cùng
--     (interview_id, user_id).
--   - Index (user_id, joined_at DESC) để query history nhanh.
--   - LEFT_AT cho phép NULL — candidate vẫn đang trong phòng hoặc đã
--     crash mà chưa ai takeover (sẽ được đóng khi row mới của người
--     khác INSERT, xem CASE 3).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS interview_participation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID NOT NULL
        REFERENCES interviews(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    candidate_name VARCHAR(255) NOT NULL,

    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    left_at TIMESTAMP,

    end_reason VARCHAR(20)
        CHECK (end_reason IN ('LEFT_NORMAL', 'TAKEN_OVER', 'CRASH')),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Query phổ biến: list lịch sử của 1 candidate, sort newest first.
CREATE INDEX IF NOT EXISTS idx_participation_log_user_joined
    ON interview_participation_log(user_id, joined_at DESC);

-- Query phụ: list các buổi đã từng có candidate (audit/debug).
CREATE INDEX IF NOT EXISTS idx_participation_log_interview
    ON interview_participation_log(interview_id);

-- Lookup row open (left_at IS NULL) của 1 candidate trong 1 interview —
-- dùng khi UPDATE left_at lúc leave hoặc đóng row cũ khi takeover.
CREATE INDEX IF NOT EXISTS idx_participation_log_open
    ON interview_participation_log(interview_id, user_id)
    WHERE left_at IS NULL;
