-- Migration: add room_presence table for realtime "who is in the room"
-- Created: 2026-07-12
--
-- Bối cảnh:
--   Bảng `interview_candidates` (1 row per interview) chỉ lưu user_id
--   của candidate đầu tiên vào phòng. Khi candidate A out, row vẫn có
--   user_id = A → candidate B vào thì check `existing.user_id !== B`
--   → return false → B bị chặn vĩnh viễn dù slot trống.
--
--   Lỗi này đến từ việc dùng "user_id cứng" thay vì "presence thực sự".
--   Khi user crash / đóng tab mà không gọi được leave API, không có cách
--   nào biết user đã out nếu dựa vào row cứng.
--
-- Thiết kế mới:
--   Bảng `room_presence` lưu user nào đang ACTIVE trong phòng.
--   - Heartbeat từ client mỗi ~20s update `last_seen_at = NOW()`.
--   - Row được coi là "đã out" khi `last_seen_at < NOW() - INTERVAL '45s'`
--     (gấp ~2 lần heartbeat) → "stale".
--   - Khi user thực sự out (unmount tab), client gọi DELETE API → row
--     bị xoá ngay lập tức, không phải đợi stale timeout.
--
-- Tại sao KHÔNG dùng cột `left_at` trong interview_candidates:
--   - interview_candidates là business data (lịch sử cuộc phỏng vấn) —
--     không nên tự mutate khi user crash.
--   - Stale-detection cần query `last_seen_at < threshold` thường xuyên
--     → cần index; bảng riêng cho phép dọn dẹp độc lập.
--   - Bảng này cũng dùng cho HOST/INTERVIEWER presence nếu sau này cần.
--
-- Lưu ý:
--   - Khi 1 user mở 2 tab cùng meeting_code → 2 rows (PK = composite
--     (interview_id, user_id, session_id) khử trùng).
--   - Khi interview FINISHED → toàn bộ rows của interview đó được xoá.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE room_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID NOT NULL
        REFERENCES interviews(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    participant_role VARCHAR(20) NOT NULL
        CHECK (participant_role IN ('HOST', 'INTERVIEWER', 'CANDIDATE')),

    -- session_id tách biệt các tab/window của cùng 1 user (random UUID
    -- client-side). Cho phép user mở 2 tab → 2 rows. Khi tab đóng,
    -- DELETE WHERE session_id = X chỉ xoá row của tab đó.
    session_id VARCHAR(64) NOT NULL,

    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (interview_id, user_id, session_id)
);

-- Query quan trọng: "có ai đang ACTIVE trong phòng (theo role) không?"
-- Phải filter last_seen_at > NOW() - 45s → partial index cho nhanh.
CREATE INDEX idx_room_presence_active_candidate
    ON room_presence(interview_id, participant_role, last_seen_at)
    WHERE participant_role = 'CANDIDATE';

CREATE INDEX idx_room_presence_interview_user
    ON room_presence(interview_id, user_id);

-- Query dọn dẹp: tìm row đã stale.
CREATE INDEX idx_room_presence_last_seen
    ON room_presence(last_seen_at);