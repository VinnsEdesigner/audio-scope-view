-- Add sample_rate column to recordings table
-- This allows tracking the sample rate used when capturing each recording

ALTER TABLE recordings ADD COLUMN sample_rate INTEGER NOT NULL DEFAULT 44100;

-- Update existing recordings to have a default sample rate
UPDATE recordings SET sample_rate = 44100 WHERE sample_rate IS NULL;

-- Create index for filtering by sample rate
CREATE INDEX IF NOT EXISTS idx_recordings_sample_rate ON recordings(sample_rate);
