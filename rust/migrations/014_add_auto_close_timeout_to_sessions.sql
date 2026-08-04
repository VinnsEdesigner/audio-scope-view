-- Migration: Add auto_close_timeout_secs column to sessions and user_preferences tables
-- This allows configuring the auto-close timeout for sessions (default: 30 seconds for sessions, 300 for preferences)

ALTER TABLE sessions ADD COLUMN auto_close_timeout_secs INTEGER DEFAULT 30;
ALTER TABLE user_preferences ADD COLUMN auto_close_timeout_secs INTEGER DEFAULT 300;
