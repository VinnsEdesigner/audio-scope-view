-- Create waveforms table for storing captured audio data
CREATE TABLE IF NOT EXISTS waveforms (
    id TEXT PRIMARY KEY NOT NULL,
    scope_id TEXT NOT NULL,
    
    -- Waveform data (stored as JSON array of floats)
    samples TEXT NOT NULL,
    sample_count INTEGER NOT NULL,
    
    -- Timing information
    timestamp TEXT NOT NULL,
    duration_ms REAL NOT NULL,
    
    -- Metadata
    peak_amplitude REAL NOT NULL DEFAULT 0.0,
    rms_amplitude REAL NOT NULL DEFAULT 0.0,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE CASCADE
);

-- Create index on scope_id and timestamp for efficient queries
CREATE INDEX IF NOT EXISTS idx_waveforms_scope_id ON waveforms(scope_id);

CREATE INDEX IF NOT EXISTS idx_waveforms_timestamp ON waveforms(timestamp DESC);

-- Create index for recent waveforms per scope
CREATE INDEX IF NOT EXISTS idx_waveforms_scope_timestamp ON waveforms(scope_id, timestamp DESC);
