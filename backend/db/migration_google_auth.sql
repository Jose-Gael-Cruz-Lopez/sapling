-- ============================================================
-- Migration: Add Google OAuth columns to users table
-- Safe to run multiple times (idempotent)
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS google_id     TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS avatar_url    TEXT,
    ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'google';

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
