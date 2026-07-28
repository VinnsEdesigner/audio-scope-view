-- Create recordings table for storing captured audio recordings

CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY NOT NULL,
    scope_id TEXT NOT NULL,
    name TEXT NOT NULL,
    samples TEXT NOT NULL,
    sample_count INTEGER NOT NULL DEFAULT 0,
    timestamp TEXT NOT NULL,
    duration_ms REAL NOT NULL DEFAULT 0.0,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    peak_amplitude REAL NOT NULL DEFAULT 0.0,
    rms_amplitude REAL NOT NULL DEFAULT 0.0,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE CASCADE
);

-- Create index for faster queries by scope
CREATE INDEX IF NOT EXISTS idx_recordings_scope_id ON recordings(scope_id);

-- Create index for sorting by timestamp
CREATE INDEX IF NOT EXISTS idx_recordings_timestamp ON recordings(timestamp DESC);

-- Create index for pinned recordings
CREATE INDEX IF NOT EXISTS idx_recordings_is_pinned ON recordings(is_pinned);

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_recordings_scope_pinned ON recordings(scope_id, is_pinned, timestamp DESC);
