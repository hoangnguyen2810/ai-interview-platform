-- Migration: 018_interview_reports_multi.sql
-- Created: 2026-07-14
--
-- Cho phép nhiều báo cáo trên 1 interview (không còn 1:1).
-- Trước đây UNIQUE(interview_id) đảm bảo mỗi interview chỉ có 1 report;
-- constraint đó bị bỏ để cho phép recruiter sinh nhiều phiên bản báo cáo.
--
-- Index cũ idx_interview_reports_interview vẫn hữu ích cho truy vấn theo
-- interview_id nên giữ nguyên. Thêm generated_at vào index để sắp xếp
-- theo thời gian tạo (dùng cho list trong UI).

    ALTER TABLE interview_reports
        DROP CONSTRAINT IF EXISTS interview_reports_interview_id_key;

    -- Index hỗ trợ list reports theo interview, sắp xếp theo thời gian tạo mới nhất.
    DROP INDEX IF EXISTS idx_interview_reports_interview;
    CREATE INDEX IF NOT EXISTS idx_interview_reports_interview_generated
        ON interview_reports(interview_id, generated_at DESC)
        WHERE deleted_at IS NULL;