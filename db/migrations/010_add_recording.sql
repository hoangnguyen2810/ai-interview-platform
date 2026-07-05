-- Migration: Interview Recording
-- Created: 2026-07-05
--
-- 1. Add `enable_recording` flag to interviews so recruiter can choose whether
--    the meeting should be recorded by the host's screen-share track.
--
-- 2. Create `recordings` table to store metadata for each uploaded video file.
--    The actual video blob lives on disk under ./recordings/<meetingCode>/.
--    File path is stored as a relative URL (e.g. "/recordings/<file>.webm")
--    so the front-end can play / download it directly through Next.js.

ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS enable_recording BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID NOT NULL
        REFERENCES interviews(id)
        ON DELETE CASCADE,

    meeting_code VARCHAR(50) NOT NULL,

    title VARCHAR(255) NOT NULL,

    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,

    mime_type VARCHAR(100) NOT NULL DEFAULT 'video/webm',
    size_bytes BIGINT NOT NULL DEFAULT 0,

    duration_seconds INT NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (
            status IN (
                'PROCESSING',
                'AVAILABLE',
                'FAILED'
            )
        ),

    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recordings_interview_id
    ON recordings(interview_id);

CREATE INDEX IF NOT EXISTS idx_recordings_meeting_code
    ON recordings(meeting_code);

CREATE INDEX IF NOT EXISTS idx_recordings_status
    ON recordings(status)
    WHERE deleted_at IS NULL;