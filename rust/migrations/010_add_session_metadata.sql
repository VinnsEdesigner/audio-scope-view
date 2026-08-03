-- Migration v10: Add session metadata and hierarchy support
-- Adds support for named sessions, descriptions, and sub-sessions

-- Add name and description columns
ALTER TABLE sessions ADD COLUMN name TEXT;
ALTER TABLE sessions ADD COLUMN description TEXT;

-- Add parent session ID for sub-session hierarchy
ALTER TABLE sessions ADD COLUMN parent_session_id TEXT REFERENCES sessions(id);

-- Flag to identify auto-created sub-sessions
ALTER TABLE sessions ADD COLUMN is_sub_session BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for efficient parent lookup
CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_session_id);

-- Create index for finding sub-sessions quickly
CREATE INDEX IF NOT EXISTS idx_sessions_is_sub ON sessions(is_sub_session) WHERE is_sub_session = TRUE;
