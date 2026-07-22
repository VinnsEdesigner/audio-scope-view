-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY NOT NULL,
    scope_id TEXT NOT NULL,
    
    -- Display settings
    time_scale REAL NOT NULL DEFAULT 1.0,
    voltage_scale REAL NOT NULL DEFAULT 1.0,
    time_offset REAL NOT NULL DEFAULT 0.0,
    voltage_offset REAL NOT NULL DEFAULT 0.0,
    
    -- Trigger settings
    trigger_level REAL NOT NULL DEFAULT 0.0,
    trigger_mode TEXT NOT NULL DEFAULT 'auto',
    trigger_edge TEXT NOT NULL DEFAULT 'rising',
    
    -- Display options
    show_grid INTEGER NOT NULL DEFAULT 1,
    show_measurements INTEGER NOT NULL DEFAULT 1,
    grid_divisions_x INTEGER NOT NULL DEFAULT 10,
    grid_divisions_y INTEGER NOT NULL DEFAULT 8,
    
    -- Audio settings
    input_device TEXT,
    input_channels INTEGER NOT NULL DEFAULT 1,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE CASCADE
);

-- Create index on scope_id
CREATE INDEX IF NOT EXISTS idx_settings_scope_id ON settings(scope_id);
