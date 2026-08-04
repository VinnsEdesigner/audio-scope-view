
#![allow(dead_code)]

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recording {
    pub id: String,
    pub session_id: String,
    pub name: String,
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub timestamp: DateTime<Utc>,
    pub duration_ms: f64,
    pub size_bytes: u64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
    pub peak_db: f32,
    pub rms_db: f32,
    pub peak_negative_db: f32,
    pub dc_offset: f32,
    pub dominant_frequency: f32,
    pub frequency_high: f32,
    pub frequency_low: f32,
    pub bit_depth: u8,
    pub is_pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingMetadata {
    pub id: String,
    pub session_id: String,
    pub name: String,
    pub sample_count: usize,
    pub sample_rate: u32,
    pub timestamp: DateTime<Utc>,
    pub duration_ms: f64,
    pub size_bytes: u64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
    pub peak_db: f32,
    pub rms_db: f32,
    pub peak_negative_db: f32,
    pub dc_offset: f32,
    pub dominant_frequency: f32,
    pub frequency_high: f32,
    pub frequency_low: f32,
    pub bit_depth: u8,
    pub is_pinned: bool,
    pub waveform_overview: Option<Vec<f32>>,
}

impl Recording {
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

        let analysis = analyze_waveform(&samples, sample_rate as f32);

        let (freq_low, freq_high) = Self::compute_frequency_bounds(&samples, sample_rate as f32);

        let peak_db = peak_to_dbfs(analysis.peak_amplitude);
        let rms_db = rms_to_dbfs(analysis.rms_amplitude);

        let negative_peak_amplitude = find_negative_peak_amplitude(&samples);
        let peak_negative_db = peak_to_dbfs(negative_peak_amplitude.abs());

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
            bit_depth: 32,             is_pinned: false,
        }
    }

    fn compute_frequency_bounds(samples: &[f32], sample_rate: f32) -> (f32, f32) {
        use crate::domain::fft_processor::FftProcessor;

        if samples.len() < 64 {
            return (20.0, sample_rate / 2.0);
        }

        let mut fft = FftProcessor::new();
        let spectrum = fft.compute_magnitudes(samples, sample_rate);

        let fft_size = spectrum.len();
        let freq_res = sample_rate / (fft_size * 2) as f32;

        let noise_floor_db = -60.0;
        let mut low_bin = 0;
        let mut high_bin = spectrum.len() - 1;

        for (i, &mag) in spectrum.iter().enumerate() {
            if mag > noise_floor_db && i > 0 {
                low_bin = i;
                break;
            }
        }

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

    pub fn sample_count(&self) -> usize {
        self.samples.len()
    }

    pub fn is_empty(&self) -> bool {
        self.samples.is_empty()
    }

    pub fn rename(&mut self, new_name: String) {
        self.name = new_name;
    }

    pub fn toggle_pin(&mut self) {
        self.is_pinned = !self.is_pinned;
    }

    pub fn set_pinned(&mut self, pinned: bool) {
        self.is_pinned = pinned;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSummary {
    pub id: String,
    pub session_id: String,
    pub name: String,
    pub sample_rate: u32,
    pub timestamp: DateTime<Utc>,
    pub duration_ms: f64,
    pub size_bytes: u64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
    pub peak_db: f32,
    pub rms_db: f32,
    pub peak_negative_db: f32,
    pub dc_offset: f32,
    pub dominant_frequency: f32,
    pub frequency_high: f32,
    pub frequency_low: f32,
    pub bit_depth: u8,
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

#[derive(Debug, Clone, Default)]
pub struct RecordingStats {
    pub total_recordings: u64,
    pub total_size_bytes: u64,
    pub total_duration_ms: f64,
    pub average_size_bytes: f64,
    pub average_duration_ms: f64,
    pub pinned_count: u64,
}

#[derive(Debug, Clone)]
pub struct RecordingStatsByRange {
    pub range: TimeRange,
    pub stats: RecordingStats,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum TimeRange {
    Today,
    LastWeek,
    LastMonth,
    #[default]
    AllTime,
}

#[derive(Debug, Clone, Default)]
pub struct RecordingFilter {
    pub session_id: Option<String>,
    pub time_range: Option<TimeRange>,
    pub is_pinned: Option<bool>,
    pub search_query: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum ScopeStatus {
    Live,
    Paused,
    #[default]
    Offline,
}

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

#[derive(Debug, Clone, Default)]
pub struct ScopeStatusCounts {
    pub live: u64,
    pub paused: u64,
    pub offline: u64,
}