-- Migration: Add session_feedback table for user feedback collection
-- Part of 100M Roadmap - Data Flywheel Phase 1

CREATE TABLE IF NOT EXISTS session_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    execution_id TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_session_feedback_session ON session_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_session_feedback_user ON session_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_session_feedback_created ON session_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_feedback_rating ON session_feedback(rating);

-- Comment for documentation
COMMENT ON TABLE session_feedback IS 'Stores user satisfaction ratings for preference learning and DPO training';
