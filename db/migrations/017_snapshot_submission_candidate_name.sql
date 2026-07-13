-- Migration: Snapshot candidate_name on code_submissions
-- Created: 2026-07-13
--
-- Root cause: A single row in `interview_candidates` is shared across the
-- whole interview (UNIQUE interview_id). When candidate B takes over from
-- candidate A, attachCandidate() UPDATEs the row's user_id + candidate_name
-- to point at B. code_submissions rows from A then render with B's name
-- because the submissions GET joins on interview_candidates.
--
-- Fix: freeze the candidate display name on each submission row at insert
-- time. After this migration, new submissions always write a snapshot of
-- users.full_name; the GET endpoint prefers that snapshot over the joined
-- candidate row.
--
-- Backfill: existing rows are populated from interview_candidates.candidate_name
-- (current value — best effort, since the slot may have already been taken
-- over by another candidate and the original name is no longer recoverable
-- from this schema).

ALTER TABLE code_submissions
ADD COLUMN IF NOT EXISTS candidate_name VARCHAR(255);

UPDATE code_submissions s
SET candidate_name = ic.candidate_name
FROM interview_candidates ic
WHERE s.interview_candidate_id = ic.id
  AND s.candidate_name IS NULL;