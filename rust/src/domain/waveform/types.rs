//! Waveform domain types

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Waveform entity
/// 
/// Represents a captured waveform with its metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Waveform {
    /// Unique identifier
    pub id: String,
    /// Associated scope ID
    pub scope_id: String,
    /// Audio samples as 32-bit floats
    pub samples: Vec<f32>,
    /// Capture timestamp
    pub timestamp: DateTime<Utc>,
    /// Duration in milliseconds
    pub duration_ms: f64,
    /// Peak amplitude
    pub peak_amplitude: f32,
    /// RMS amplitude
    pub rms_amplitude: f32,
}

impl Waveform {
    /// Create a new waveform from samples
    pub fn new(id: String, scope_id: String, samples: Vec<f32>, sample_rate: u32) -> Self {
        let now = Utc::now();
        let duration_ms = (samples.len() as f64 / sample_rate as f64) * 1000.0;
        
        let peak_amplitude = samples.iter()
            .map(|s| s.abs())
            .fold(0.0f32, |a, b| a.max(b));
        
        let sum_squares: f32 = samples.iter()
            .map(|s| s * s)
            .sum();
        let rms_amplitude = (sum_squares / samples.len() as f32).sqrt();

        Self {
            id,
            scope_id,
            samples,
            timestamp: now,
            duration_ms,
            peak_amplitude,
            rms_amplitude,
        }
    }

    /// Get the number of samples
    pub fn sample_count(&self) -> usize {
        self.samples.len()
    }

    /// Check if waveform is empty
    pub fn is_empty(&self) -> bool {
        self.samples.is_empty()
    }

    /// Calculate the time step between samples
    pub fn time_step(&self, sample_rate: u32) -> f64 {
        1.0 / sample_rate as f64
    }
}

/// Waveform statistics
#[derive(Debug, Clone, Default)]
pub struct WaveformStatistics {
    pub total_count: u64,
    pub total_samples: u64,
    pub average_peak: f32,
    pub average_rms: f32,
    pub min_peak: f32,
    pub max_peak: f32,
}

/// Waveform filter parameters
#[derive(Debug, Clone)]
pub struct WaveformFilter {
    pub scope_id: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub min_amplitude: Option<f32>,
    pub max_amplitude: Option<f32>,
}

impl Default for WaveformFilter {
    fn default() -> Self {
        Self {
            scope_id: None,
            start_time: None,
            end_time: None,
            min_amplitude: None,
            max_amplitude: None,
        }
    }
}
