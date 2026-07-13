-- Migration: 016_interview_reports.sql
-- Created: 2026-07-13
--
-- Báo cáo tổng hợp AI cho mỗi interview, có thể chỉnh sửa bởi recruiter.
-- Mỗi meeting_code có tối đa 1 report (1:1 với interview qua meeting_code).
-- Lưu JSONB content để linh hoạt schema từng section; snapshot CV/AI inputs
-- ở snapshot_* để audit và tái sinh nếu cần.
--
-- Theo convention: UUID PK, CURRENT_TIMESTAMP timestamps, IF NOT EXISTS cho
-- mọi DDL để chạy lại idempotent. AI Python service tạo CV/session context ở
-- bộ nhớ tách biệt (ai/app/core/sessions.py), không liên quan tới bảng này.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS interview_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID NOT NULL
        REFERENCES interviews(id)
        ON DELETE CASCADE,

    -- 1 report / interview (UNIQUE).
    UNIQUE(interview_id),

    -- Nội dung báo cáo, chia theo sections để recruiter chỉnh sửa từng phần.
    -- Mỗi section là 1 string (text dài) hoặc JSONB tùy schema do AI sinh.
    -- Mặc định 8 sections theo CHAT_PROMPT rule 8:
    --   candidate_name, position, summary, strengths, weaknesses,
    --   skill_evaluation, improvement_suggestions, hiring_conclusion.
    content JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Snapshot CV (markdown + filename) tại thời điểm sinh báo cáo.
    cv_filename TEXT,
    cv_markdown TEXT,
    cv_analysis TEXT,

    -- Snapshot coding analysis gộp từ tất cả ai_reviews của interview này.
    -- Lưu dạng text đã tổng hợp để AI dùng lại, tránh phải JOIN lại.
    coding_analysis_snapshot TEXT,

    -- Điểm đề xuất từ AI (0..10), recruiter có thể override sau.
    ai_overall_score NUMERIC(5,2),

    -- Model sinh báo cáo, vd 'qwen2.5:3b-instruct' (khớp với ai/app/api/cv.py).
    ai_model VARCHAR(100),

    -- Status workflow: DRAFT (vừa sinh, chưa sửa) | EDITED (recruiter đã sửa) | FINAL.
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','EDITED','FINAL')),

    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

    deleted_at TIMESTAMP
);

-- Truy vấn chính: lấy report của 1 interview còn sống.
CREATE INDEX IF NOT EXISTS idx_interview_reports_interview
    ON interview_reports(interview_id)
    WHERE deleted_at IS NULL;

-- Lọc theo status cho trang list (DRAFT vs FINAL).
CREATE INDEX IF NOT EXISTS idx_interview_reports_status
    ON interview_reports(status)
    WHERE deleted_at IS NULL;