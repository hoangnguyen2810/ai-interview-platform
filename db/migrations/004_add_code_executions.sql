-- Migration: Add code executions tracking for sandbox runs
-- Created: 2026-06-26
-- Tracks individual code execution runs (not submissions) for sandbox testing

-- 1. Track each code execution run
CREATE TABLE IF NOT EXISTS code_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to interview and question
    interview_id UUID NOT NULL
        REFERENCES interviews(id)
        ON DELETE CASCADE,

    question_id UUID
        REFERENCES coding_questions(id)
        ON DELETE SET NULL,

    -- Execution details
    language VARCHAR(50) NOT NULL,

    source_code TEXT NOT NULL,

    stdin_data TEXT,

    -- Results
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (
        status IN (
            'PENDING',
            'RUNNING',
            'SUCCESS',
            'TIMEOUT',
            'COMPILE_ERROR',
            'RUNTIME_ERROR',
            'SYSTEM_ERROR'
        )
    ),

    stdout TEXT,

    stderr TEXT,

    exit_code INT,

    runtime_ms INT,

    memory_kb INT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    completed_at TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_code_executions_interview_id
ON code_executions(interview_id);

CREATE INDEX IF NOT EXISTS idx_code_executions_question_id
ON code_executions(question_id);

CREATE INDEX IF NOT EXISTS idx_code_executions_status
ON code_executions(status);

CREATE INDEX IF NOT EXISTS idx_code_executions_created_at
ON code_executions(created_at DESC);

-- 2. Add execution tracking to code_submissions
-- This links submissions to their actual execution results
ALTER TABLE code_submissions
ADD COLUMN IF NOT EXISTS execution_id UUID
REFERENCES code_executions(id) ON DELETE SET NULL;

-- Add more detailed status for submissions
ALTER TABLE code_submissions
DROP CONSTRAINT IF EXISTS code_submissions_status_check;

ALTER TABLE code_submissions
ADD CONSTRAINT code_submissions_status_check
CHECK (
    status IN (
        'PENDING',
        'RUNNING',
        'ACCEPTED',
        'WRONG_ANSWER',
        'COMPILE_ERROR',
        'RUNTIME_ERROR',
        'TIMEOUT',
        'SYSTEM_ERROR'
    )
);
