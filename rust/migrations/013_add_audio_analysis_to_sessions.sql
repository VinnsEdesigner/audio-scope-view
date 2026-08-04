-- Migration v13: Add audio analysis columns to sessions table
-- These columns store audio analysis metrics for sessions

ALTER TABLE sessions ADD COLUMN peak_amplitude REAL NOT NULL DEFAULT 0.0;
ALTER TABLE sessions ADD COLUMN rms_amplitude REAL NOT NULL DEFAULT 0.0;
ALTER TABLE sessions ADD COLUMN dc_offset REAL NOT NULL DEFAULT 0.0;
ALTER TABLE sessions ADD COLUMN dominant_frequency REAL NOT NULL DEFAULT 0.0;
ALTER TABLE sessions ADD COLUMN frequency_high REAL NOT NULL DEFAULT 0.0;
ALTER TABLE sessions ADD COLUMN frequency_low REAL NOT NULL DEFAULT 0.0;
