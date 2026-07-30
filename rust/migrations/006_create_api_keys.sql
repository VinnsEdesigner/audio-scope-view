-- Migration v6: Create API keys table for persistent API key storage

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
    expires_at TEXT,
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create index on key_hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);
