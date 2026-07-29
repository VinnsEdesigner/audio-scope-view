-- Migration v4: Replace scopes with sessions
-- Sessions are ephemeral records of canvas instances

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    duration_seconds INTEGER
);

-- Create index on started_at for ordering
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
