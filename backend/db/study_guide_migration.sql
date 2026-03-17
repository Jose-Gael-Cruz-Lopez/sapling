-- ============================================================
-- Study Guides cache table
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

CREATE TABLE IF NOT EXISTS study_guides (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course       TEXT NOT NULL,
    exam_id      TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    content      TEXT NOT NULL,
    UNIQUE(user_id, course, exam_id)
);

CREATE INDEX IF NOT EXISTS idx_study_guides_user ON study_guides(user_id);
CREATE INDEX IF NOT EXISTS idx_study_guides_user_course ON study_guides(user_id, course);
