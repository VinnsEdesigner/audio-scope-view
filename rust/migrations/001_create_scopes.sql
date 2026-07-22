-- Create scopes table
CREATE TABLE IF NOT EXISTS scopes (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sample_rate INTEGER NOT NULL DEFAULT 44100,
    buffer_size INTEGER NOT NULL DEFAULT 1024,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create index on active scopes
CREATE INDEX IF NOT EXISTS idx_scopes_is_active ON scopes(is_active);

-- Create index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_scopes_created_at ON scopes(created_at DESC);
