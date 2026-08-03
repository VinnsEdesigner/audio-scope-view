-- Add waveform_overview column for fast preview loading
-- This stores the pre-computed downsampled waveform data (min-max pairs)
-- to avoid loading all samples just for display

-- SQLite 3.35.0+ supports IF NOT EXISTS for ALTER TABLE ADD COLUMN
ALTER TABLE recordings ADD COLUMN waveform_overview TEXT;
