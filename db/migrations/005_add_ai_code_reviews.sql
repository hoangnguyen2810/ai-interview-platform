-- Migration: Add AI Code Review
-- Created: 2026-07-04
-- Stores AI-generated reviews for candidate submissions, plus
-- the AI-generated edge test cases and their execution results.

-- 1. Extend ai_reviews with full breakdown of the review
ALTER TABLE ai_reviews
ADD COLUMN IF NOT EXISTS correctness_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS algorithm_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS time_complexity VARCHAR(50),
ADD COLUMN IF NOT EXISTS space_complexity VARCHAR(50),
ADD COLUMN IF NOT EXISTS overall_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS hint TEXT,
ADD COLUMN IF NOT EXISTS model_name VARCHAR(100) DEFAULT 'qwen2.5-coder:3b',
ADD COLUMN IF NOT EXISTS raw_analysis JSONB,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 2. AI-generated test cases (one row per AI-proposed test case)
CREATE TABLE IF NOT EXISTS ai_generated_test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id UUID NOT NULL
        REFERENCES code_submissions(id)
        ON DELETE CASCADE,

    input_data TEXT NOT NULL,
    expected_output TEXT,
    description TEXT,
    edge_case_type VARCHAR(50), -- e.g. 'empty', 'large', 'negative', 'duplicate', 'overflow'

    status VARCHAR(20) DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PASSED', 'FAILED', 'RUNTIME_ERROR', 'TIMEOUT')),

    actual_output TEXT,
    stderr TEXT,
    runtime_ms INT,
    execution_order INT DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_generated_test_cases_submission_id
    ON ai_generated_test_cases(submission_id);
