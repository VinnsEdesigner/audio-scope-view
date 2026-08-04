-- Add frequency analysis and dB columns to recordings table
-- These fields store computed audio analysis metrics

-- dB values (amplitude in decibels relative to full scale)
ALTER TABLE recordings ADD COLUMN peak_db REAL NOT NULL DEFAULT 0.0;
ALTER TABLE recordings ADD COLUMN rms_db REAL NOT NULL DEFAULT 0.0;
ALTER TABLE recordings ADD COLUMN peak_negative_db REAL NOT NULL DEFAULT 0.0;

-- DC offset (average amplitude, indicates bias in the signal)
ALTER TABLE recordings ADD COLUMN dc_offset REAL NOT NULL DEFAULT 0.0;

-- Frequency analysis metrics
ALTER TABLE recordings ADD COLUMN dominant_frequency REAL NOT NULL DEFAULT 0.0;
ALTER TABLE recordings ADD COLUMN frequency_high REAL NOT NULL DEFAULT 0.0;
ALTER TABLE recordings ADD COLUMN frequency_low REAL NOT NULL DEFAULT 0.0;

-- Bit depth of the recording (32 for float samples)
ALTER TABLE recordings ADD COLUMN bit_depth INTEGER NOT NULL DEFAULT 32;
