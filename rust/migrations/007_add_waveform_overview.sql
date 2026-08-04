-- Add waveform_overview column for fast preview loading
-- This stores the pre-computed downsampled waveform data (min-max pairs)
-- to avoid loading all samples just for display

ALTER TABLE recordings ADD COLUMN waveform_overview TEXT;
