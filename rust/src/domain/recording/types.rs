//! Recording domain types

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
    /// Peak amplitude
    pub peak_amplitude: f32,
    /// RMS amplitude
    pub rms_amplitude: f32,
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
    /// Peak amplitude
    pub peak_amplitude: f32,
    /// RMS amplitude
    pub rms_amplitude: f32,
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
        let now = Utc::now();
        let duration_ms = (samples.len() as f64 / sample_rate as f64) * 1000.0;

        let peak_amplitude = samples.iter().map(|s| s.abs()).fold(0.0f32, |a, b| a.max(b));

        let sum_squares: f32 = samples.iter().map(|s| s * s).sum();
        let rms_amplitude = (sum_squares / samples.len() as f32).sqrt();

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
            peak_amplitude,
            rms_amplitude,
            is_pinned: false,
        }
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
    /// Peak amplitude
    pub peak_amplitude: f32,
    /// RMS amplitude
    pub rms_amplitude: f32,
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
