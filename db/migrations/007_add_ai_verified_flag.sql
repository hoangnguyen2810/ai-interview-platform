-- Migration: AI Code Review — track whether AI-suggested tests are self-verified
-- Created: 2026-07-04
-- When the analyzer can auto-run tests, we run each AI-suggested test once
-- against the candidate's source code immediately. If the test PASSES on that
-- first run, the test is considered "AI verified" (the AI generated a coherent
-- input/output pair). If it FAILS / RUNTIME_ERROR / TIMEOUT on the first run,
-- the recruiter should manually review and adjust the test before relying on
-- it as a signal about the candidate.
--
-- Editing input_data or expected_output by the recruiter also resets the flag
-- to FALSE because the test no longer matches what the AI originally produced.

ALTER TABLE ai_generated_test_cases
ADD COLUMN IF NOT EXISTS ai_verified BOOLEAN;

-- Backfill existing rows: any test that already passed once is verified.
-- For anything else (FAILED / RUNTIME_ERROR / TIMEOUT / PENDING) we leave NULL
-- so the UI can render an "Unverified" badge without claiming either truth.
UPDATE ai_generated_test_cases
SET ai_verified = (status = 'PASSED')
WHERE ai_verified IS NULL;