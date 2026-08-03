//! Recording domain types

#![allow(dead_code)]

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Recording entity
///
/// Represents a captured recording with its metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recording {
    /// Unique identifier
    pub id: String,
    /// Associated session ID
    pub session_id: String,
    /// Display name
    pub name: String,
    /// Audio samples as 32-bit floats
    pub samples: Vec<f32>,
    /// Sample rate in Hz
    pub sample_rate: u32,
    /// Capture timestamp
    pub timestamp: DateTime<Utc>,
    /// Duration in milliseconds
    pub duration_ms: f64,
    /// File size in bytes
    pub size_bytes: u64,
    /// Peak amplitude (0 to 1)
    pub peak_amplitude: f32,
    /// RMS amplitude (0 to 1)
    pub rms_amplitude: f32,
    /// Peak amplitude in dBFS (0 dBFS = full scale)
    pub peak_db: f32,
    /// RMS amplitude in dBFS
    pub rms_db: f32,
    /// Negative peak amplitude in dBFS (most negative value)
    pub peak_negative_db: f32,
    /// DC offset (average)
    pub dc_offset: f32,
    /// Dominant/peak frequency in Hz
    pub dominant_frequency: f32,
    /// Highest significant frequency in Hz
    pub frequency_high: f32,
    /// Lowest significant frequency in Hz
    pub frequency_low: f32,
    /// Bit depth (bits per sample)
    pub bit_depth: u8,
    /// Whether recording is pinned
    pub is_pinned: bool,
}

/// Recording metadata (without samples)
/// Used for fast preview loading without fetching audio data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingMetadata {
    /// Unique identifier
    pub id: String,
    /// Associated session ID
    pub session_id: String,
    /// Display name
    pub name: String,
    /// Number of audio samples
    pub sample_count: usize,
    /// Sample rate in Hz
    pub sample_rate: u32,
    /// Capture timestamp
    pub timestamp: DateTime<Utc>,
    /// Duration in milliseconds
    pub duration_ms: f64,
    /// File size in bytes
    pub size_bytes: u64,
    /// Peak amplitude (0 to 1)
    pub peak_amplitude: f32,
    /// RMS amplitude (0 to 1)
    pub rms_amplitude: f32,
    /// Peak amplitude in dBFS
    pub peak_db: f32,
    /// RMS amplitude in dBFS
    pub rms_db: f32,
    /// Negative peak amplitude in dBFS
    pub peak_negative_db: f32,
    /// DC offset (average)
    pub dc_offset: f32,
    /// Dominant/peak frequency in Hz
    pub dominant_frequency: f32,
    /// Highest significant frequency in Hz
    pub frequency_high: f32,
    /// Lowest significant frequency in Hz
    pub frequency_low: f32,
    /// Bit depth (bits per sample)
    pub bit_depth: u8,
    /// Whether recording is pinned
    pub is_pinned: bool,
    /// Pre-computed waveform overview (min-max pairs) for fast display
    pub waveform_overview: Option<Vec<f32>>,
}

impl Recording {
    /// Create a new recording from samples
    pub fn new(
        id: String,
        session_id: String,
        name: String,
        samples: Vec<f32>,
        sample_rate: u32,
    ) -> Self {
        use crate::domain::measurements::{analyze_waveform, find_negative_peak_amplitude, peak_to_dbfs, rms_to_dbfs};

        let now = Utc::now();
        let duration_ms = (samples.len() as f64 / sample_rate as f64) * 1000.0;

        // Analyze waveform for DSP metrics
        let analysis = analyze_waveform(&samples, sample_rate as f32);

        // Compute frequency bounds using FFT
        let (freq_low, freq_high) = Self::compute_frequency_bounds(&samples, sample_rate as f32);

        // Compute dB values
        let peak_db = peak_to_dbfs(analysis.peak_amplitude);
        let rms_db = rms_to_dbfs(analysis.rms_amplitude);

        // Compute negative peak dB (find_negative_peak_amplitude returns the most negative value)
        let negative_peak_amplitude = find_negative_peak_amplitude(&samples);
        let peak_negative_db = peak_to_dbfs(negative_peak_amplitude.abs());

        // Estimate file size (4 bytes per sample for f32)
        let size_bytes = (samples.len() * 4) as u64;

        Self {
            id,
            session_id,
            name,
            samples,
            sample_rate,
            timestamp: now,
            duration_ms,
            size_bytes,
            peak_amplitude: analysis.peak_amplitude,
            rms_amplitude: analysis.rms_amplitude,
            peak_db,
            rms_db,
            peak_negative_db,
            dc_offset: analysis.dc_offset,
            dominant_frequency: analysis.dominant_frequency,
            frequency_high: freq_high,
            frequency_low: freq_low,
            bit_depth: 32, // f32 is 32-bit float
            is_pinned: false,
        }
    }

    /// Compute frequency bounds from samples using FFT
    fn compute_frequency_bounds(samples: &[f32], sample_rate: f32) -> (f32, f32) {
        use crate::domain::fft_processor::FftProcessor;

        if samples.len() < 64 {
            return (20.0, sample_rate / 2.0);
        }

        let mut fft = FftProcessor::new();
        let spectrum = fft.compute_magnitudes(samples, sample_rate);

        // Find frequency resolution
        let fft_size = spectrum.len();
        let freq_res = sample_rate / (fft_size * 2) as f32;

        // Find -60dB cutoff boundaries
        let noise_floor_db = -60.0;
        let mut low_bin = 0;
        let mut high_bin = spectrum.len() - 1;

        // Find low frequency cutoff (first bin above noise floor)
        for (i, &mag) in spectrum.iter().enumerate() {
            if mag > noise_floor_db && i > 0 {
                low_bin = i;
                break;
            }
        }

        // Find high frequency cutoff (last bin above noise floor)
        for (i, &mag) in spectrum.iter().enumerate().rev() {
            if mag > noise_floor_db {
                high_bin = i;
                break;
            }
        }

        let freq_low = (low_bin as f32 * freq_res).max(20.0);
        let freq_high = (high_bin as f32 * freq_res).min(sample_rate / 2.0);

        (freq_low, freq_high)
    }

    /// Get the number of samples
    pub fn sample_count(&self) -> usize {
        self.samples.len()
    }

    /// Check if recording is empty
    pub fn is_empty(&self) -> bool {
        self.samples.is_empty()
    }

    /// Rename the recording
    pub fn rename(&mut self, new_name: String) {
        self.name = new_name;
    }

    /// Toggle pin status
    pub fn toggle_pin(&mut self) {
        self.is_pinned = !self.is_pinned;
    }

    /// Set pin status
    pub fn set_pinned(&mut self, pinned: bool) {
        self.is_pinned = pinned;
    }
}

/// Recording summary (without samples) for lists
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSummary {
    /// Unique identifier
    pub id: String,
    /// Associated session ID
    pub session_id: String,
    /// Display name
    pub name: String,
    /// Sample rate in Hz
    pub sample_rate: u32,
    /// Capture timestamp
    pub timestamp: DateTime<Utc>,
    /// Duration in milliseconds
    pub duration_ms: f64,
    /// File size in bytes
    pub size_bytes: u64,
    /// Peak amplitude (0 to 1)
    pub peak_amplitude: f32,
    /// RMS amplitude (0 to 1)
    pub rms_amplitude: f32,
    /// Peak amplitude in dBFS
    pub peak_db: f32,
    /// RMS amplitude in dBFS
    pub rms_db: f32,
    /// Negative peak amplitude in dBFS
    pub peak_negative_db: f32,
    /// DC offset (average)
    pub dc_offset: f32,
    /// Dominant/peak frequency in Hz
    pub dominant_frequency: f32,
    /// Highest significant frequency in Hz
    pub frequency_high: f32,
    /// Lowest significant frequency in Hz
    pub frequency_low: f32,
    /// Bit depth (bits per sample)
    pub bit_depth: u8,
    /// Whether recording is pinned
    pub is_pinned: bool,
}

impl From<Recording> for RecordingSummary {
    fn from(recording: Recording) -> Self {
        Self {
            id: recording.id,
            session_id: recording.session_id,
            name: recording.name,
            sample_rate: recording.sample_rate,
            timestamp: recording.timestamp,
            duration_ms: recording.duration_ms,
            size_bytes: recording.size_bytes,
            peak_amplitude: recording.peak_amplitude,
            rms_amplitude: recording.rms_amplitude,
            peak_db: recording.peak_db,
            rms_db: recording.rms_db,
            peak_negative_db: recording.peak_negative_db,
            dc_offset: recording.dc_offset,
            dominant_frequency: recording.dominant_frequency,
            frequency_high: recording.frequency_high,
            frequency_low: recording.frequency_low,
            bit_depth: recording.bit_depth,
            is_pinned: recording.is_pinned,
        }
    }
}

/// Recording statistics
#[derive(Debug, Clone, Default)]
pub struct RecordingStats {
    pub total_recordings: u64,
    pub total_size_bytes: u64,
    pub total_duration_ms: f64,
    pub average_size_bytes: f64,
    pub average_duration_ms: f64,
    pub pinned_count: u64,
}

/// Recording statistics by time range
#[derive(Debug, Clone)]
pub struct RecordingStatsByRange {
    pub range: TimeRange,
    pub stats: RecordingStats,
}

/// Time range for filtering recordings
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum TimeRange {
    Today,
    LastWeek,
    LastMonth,
    #[default]
    AllTime,
}

/// Recording filter parameters
#[derive(Debug, Clone, Default)]
pub struct RecordingFilter {
    pub session_id: Option<String>,
    pub time_range: Option<TimeRange>,
    pub is_pinned: Option<bool>,
    pub search_query: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
}

/// Session status enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum ScopeStatus {
    /// Session is actively capturing
    Live,
    /// Session is paused
    Paused,
    /// Session is offline/not available
    #[default]
    Offline,
}

/// Session with status for home page for the home page
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionWithStatus {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: ScopeStatus,
    pub sample_rate: u32,
    pub buffer_size: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub recording_count: u64,
    pub last_activity_at: Option<DateTime<Utc>>,
}

/// Scope status counts for dashboard
#[derive(Debug, Clone, Default)]
pub struct ScopeStatusCounts {
    pub live: u64,
    pub paused: u64,
    pub offline: u64,
}
