-- Migration: Add chat message enhancements
-- Created: 2026-06-21
-- Description: Add meeting_code to messages table for direct lookup by meeting code,
--              add sender_name for display without join, create indexes for performance.

-- 0. Make session_id nullable (chat messages may exist without a session)
ALTER TABLE messages
ALTER COLUMN session_id DROP NOT NULL;

-- 1. Add meeting_code column to messages table (nullable, for direct meeting-code lookup)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS meeting_code VARCHAR(50);

-- 2. Add sender_name column for quick display without user join
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255);

-- 3. Create index for fast message retrieval by meeting code
CREATE INDEX IF NOT EXISTS idx_messages_meeting_code
ON messages(meeting_code);

-- 4. Create index for chronological message ordering by meeting
CREATE INDEX IF NOT EXISTS idx_messages_meeting_created
ON messages(meeting_code, created_at ASC);


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