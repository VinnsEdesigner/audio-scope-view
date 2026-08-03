-- Create recordings table for storing captured audio recordings

CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
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
    waveform_overview TEXT,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Create index for faster queries by session
CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);

-- Create index for sorting by timestamp
CREATE INDEX IF NOT EXISTS idx_recordings_timestamp ON recordings(timestamp DESC);

-- Create index for pinned recordings
CREATE INDEX IF NOT EXISTS idx_recordings_is_pinned ON recordings(is_pinned);

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_recordings_session_pinned ON recordings(session_id, is_pinned, timestamp DESC);
