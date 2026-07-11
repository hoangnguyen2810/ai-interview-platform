-- Migration: recordings dedupe by (call_cid, filename)
-- Created: 2026-07-11
--
-- Lý do thay đổi unique key:
--   Migration 010 dùng `url` làm dedup key. Nhưng GetStream có thể rotate
--   URL CDN (vd khi rotate storage backend) trong khi filename + call_cid
--   vẫn giữ nguyên → 1 file thực tế có thể xuất hiện nhiều row trong DB,
--   mỗi row với 1 URL khác nhau.
--
--   Giải pháp: thay key thành (call_cid, filename) — định danh "1 file ghi"
--   của 1 call. `duration` không cần vì filename đã unique-per-session.
--
-- 1. Xoá unique index cũ trên `url`.
-- 2. Dedupe rows hiện tại: với mỗi nhóm (call_cid, filename), giữ lại 1
--    row (row có created_at sớm nhất, url dài nhất = "ưu tiên").
-- 3. Tạo unique index mới trên (call_cid, filename).
-- 4. ON CONFLICT (call_cid, filename) DO NOTHING trong route handler.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Xoá unique index cũ.
DROP INDEX IF EXISTS uq_recordings_url;

-- 2. Dedupe rows hiện tại (back-fill).
--    Với mỗi (call_cid, filename) chỉ giữ 1 row: giữ row có created_at
--    sớm nhất (file xuất hiện đầu tiên trong DB), id nhỏ nhất tie-break.
DELETE FROM recordings r1
USING recordings r2
WHERE r1.call_cid = r2.call_cid
  AND r1.filename IS NOT NULL
  AND r1.filename = r2.filename
  AND (
    r1.created_at > r2.created_at
    OR (r1.created_at = r2.created_at AND r1.id > r2.id)
  );

-- 3. Unique index mới: (call_cid, filename).
--    Filename = session_id-prefixed bởi GetStream → unique-per-file-per-call.
--    Cùng filename nghĩa là cùng file ghi.
CREATE UNIQUE INDEX IF NOT EXISTS uq_recordings_call_cid_filename
    ON recordings(call_cid, filename)
    WHERE filename IS NOT NULL;

-- 4. Index phụ cho query theo callCid vẫn cần (UI list theo cuộc).
CREATE INDEX IF NOT EXISTS idx_recordings_call_cid
    ON recordings(call_cid);

-- Index theo created_at để UI sort newest-first.
CREATE INDEX IF NOT EXISTS idx_recordings_created_at
    ON recordings(created_at DESC);

-- Index cũ đã tạo ở migration 010 — bỏ qua vì IF NOT EXISTS sẽ skip.
