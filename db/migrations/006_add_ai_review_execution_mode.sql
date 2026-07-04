-- Migration: AI Code Review — execution mode & manual test cases
-- Created: 2026-07-04
-- Adds metadata about how the candidate's source code accepts input so the
-- code-review route can decide whether to auto-run generated tests.

-- 1. ai_reviews: classify how the program accepts input.
ALTER TABLE ai_reviews
ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(20)
    CHECK (execution_mode IN ('stdin', 'hardcoded', 'function', 'unknown')),
ADD COLUMN IF NOT EXISTS analysis_confidence NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS analysis_reason TEXT,
ADD COLUMN IF NOT EXISTS analysis_entry_point VARCHAR(500),
ADD COLUMN IF NOT EXISTS uses_hardcoded_values BOOLEAN DEFAULT FALSE;

-- 2. ai_generated_test_cases: track who created the test case so we can
-- distinguish AI-suggested ones from recruiter-authored ones.
ALTER TABLE ai_generated_test_cases
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'AI'
    CHECK (source IN ('AI', 'MANUAL'));

CREATE INDEX IF NOT EXISTS idx_ai_generated_test_cases_source
    ON ai_generated_test_cases(submission_id, source);