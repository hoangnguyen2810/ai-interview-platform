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
