-- ============================================================
-- AI Phase 1B: Duplicate generation prevention
-- ============================================================
-- Adds a partial unique index to prevent concurrent active
-- generations (queued or generating) for the same snapshot.
-- A new generation can only be created after the previous one
-- reaches a terminal state (draft_generated, failed, approved, rejected).

CREATE INDEX IF NOT EXISTS idx_analysis_generations_active_unique
  ON analysis_generations (snapshot_id)
  WHERE status IN ('queued', 'generating');