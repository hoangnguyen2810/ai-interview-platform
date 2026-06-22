-- Migration: Add interview questions real-time support
-- Created: 2026-06-22
-- Tracks the active question per interview so candidates see the current problem.
-- The recruiter sets the active question; it syncs via Stream custom events.

-- 1. Track which question is currently active in the interview
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS active_question_id UUID REFERENCES coding_questions(id) ON DELETE SET NULL;

-- 2. Add created_by to coding_questions if missing (for "custom question" authorship)
ALTER TABLE coding_questions
ALTER COLUMN created_by SET NOT NULL;

-- 3. Index for fast lookup of questions by interview
CREATE INDEX IF NOT EXISTS idx_interview_questions_interview_id
ON interview_questions(interview_id);

CREATE INDEX IF NOT EXISTS idx_interview_questions_order
ON interview_questions(interview_id, question_order);
