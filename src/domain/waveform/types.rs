
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Waveform {
    pub id: String,
    pub session_id: String,
    pub samples: Vec<f32>,
    pub timestamp: DateTime<Utc>,
    pub duration_ms: f64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
}

impl Waveform {
    pub fn new(id: String, session_id: String, samples: Vec<f32>, sample_rate: u32) -> Self {
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
            session_id,
            samples,
            timestamp: now,
            duration_ms,
            peak_amplitude,
            rms_amplitude,
        }
    }

    pub fn sample_count(&self) -> usize {
        self.samples.len()
    }

    pub fn is_empty(&self) -> bool {
        self.samples.is_empty()
    }

    pub fn time_step(&self, sample_rate: u32) -> f64 {
        1.0 / sample_rate as f64
    }
}

#[derive(Debug, Clone, Default)]
pub struct WaveformStatistics {
    pub total_count: u64,
    pub total_samples: u64,
    pub average_peak: f32,
    pub average_rms: f32,
    pub min_peak: f32,
    pub max_peak: f32,
}

#[derive(Debug, Clone)]
pub struct WaveformFilter {
    pub session_id: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub min_amplitude: Option<f32>,
    pub max_amplitude: Option<f32>,
}

impl Default for WaveformFilter {
    fn default() -> Self {
        Self {
            session_id: None,
            start_time: None,
            end_time: None,
            min_amplitude: None,
            max_amplitude: None,
        }
    }
}
