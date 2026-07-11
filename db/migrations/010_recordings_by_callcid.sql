-- Migration: recordings (per GetStream callCid)
-- Created: 2026-07-11
--
-- Bảng `recordings` lưu metadata từng file recording lấy từ GetStream.
-- Source trigger: GET /api/recordings/[callCid] gọi GetStream API rồi
-- INSERT vào đây (xem lib/stream-recording-service.ts). Không dùng webhook
-- hay background job — chỉ fetch on-demand.
--
-- Schema (theo spec):
--   - id            : UUID
--   - call_cid      : GetStream call cid, dạng "default:NC-XXXX"
--   - url           : URL playback trên GetStream CDN
--   - filename      : tên file gốc
--   - duration      : thời lượng (giây)
--   - recording_type: loại recording (e.g. "composite", "individual")
--   - created_at    : thời điểm recording được tạo trên GetStream

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS recordings CASCADE;

CREATE TABLE recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    call_cid VARCHAR(200) NOT NULL,

    -- file URL playback. Đây là định danh tự nhiên của recording trên
    -- GetStream — cùng `url` nghĩa là cùng 1 file → dùng partial unique
    -- index để chống insert trùng (idempotent).
    url TEXT NOT NULL,

    filename VARCHAR(255),

    duration INTEGER NOT NULL DEFAULT 0,

    recording_type VARCHAR(50),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Partial unique index: chỉ áp dụng cho rows còn "live" (deleted_at IS NULL).
-- `url` là dedup key vì GetStream đảm bảo mỗi file chỉ có 1 URL.
-- Sau này nếu cần soft-delete thì giữ partial index, không cần migrate lại.
CREATE UNIQUE INDEX IF NOT EXISTS uq_recordings_url
    ON recordings(url);

-- Index phụ cho query theo callCid — UI list recordings theo từng meeting.
CREATE INDEX IF NOT EXISTS idx_recordings_call_cid
    ON recordings(call_cid);

-- Index theo created_at để UI sort newest-first.
CREATE INDEX IF NOT EXISTS idx_recordings_created_at
    ON recordings(created_at DESC);
