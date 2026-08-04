-- Add oscilloscope tracking columns to sessions table
ALTER TABLE sessions ADD COLUMN oscilloscope_opened_at TEXT;
ALTER TABLE sessions ADD COLUMN oscilloscope_duration_ms REAL;
