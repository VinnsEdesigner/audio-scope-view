//! Waveform entity - Captured audio waveform data

#![allow(dead_code)]
use chrono::{DateTime, Utc};

use super::fft_processor::{FftProcessor, Spectrum, WindowType};
use super::measurements::{self, WaveformAnalysis};

/// Waveform data representing captured audio samples
#[derive(Debug, Clone, PartialEq)]
pub struct Waveform {
    pub id: String,
    pub scope_id: String,
    pub samples: Vec<f32>,
    pub timestamp: DateTime<Utc>,
    pub duration_ms: f64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
}

impl Waveform {
    /// Create a new Waveform
    pub fn new(id: String, scope_id: String, samples: Vec<f32>, timestamp: DateTime<Utc>) -> Self {
        let peak_amplitude = Self::calculate_peak(&samples);
        let rms_amplitude = Self::calculate_rms(&samples);
        let duration_ms = samples.len() as f64 / 44.1; // Assuming 44100 Hz sample rate

        Self {
            id,
            scope_id,
            samples,
            timestamp,
            duration_ms,
            peak_amplitude,
            rms_amplitude,
        }
    }

    /// Create a waveform with explicit duration
    pub fn with_duration(
        id: String,
        scope_id: String,
        samples: Vec<f32>,
        timestamp: DateTime<Utc>,
        sample_rate: f64,
    ) -> Self {
        let peak_amplitude = Self::calculate_peak(&samples);
        let rms_amplitude = Self::calculate_rms(&samples);
        let duration_ms = samples.len() as f64 / sample_rate * 1000.0;

        Self {
            id,
            scope_id,
            samples,
            timestamp,
            duration_ms,
            peak_amplitude,
            rms_amplitude,
        }
    }

    /// Calculate peak amplitude (max absolute value)
    fn calculate_peak(samples: &[f32]) -> f32 {
        samples
            .iter()
            .map(|s| s.abs())
            .fold(0.0f32, |max, s| if s > max { s } else { max })
    }

    /// Calculate RMS (Root Mean Square) amplitude
    fn calculate_rms(samples: &[f32]) -> f32 {
        if samples.is_empty() {
            return 0.0;
        }
        let sum_squares: f32 = samples.iter().map(|s| s * s).sum();
        (sum_squares / samples.len() as f32).sqrt()
    }

    /// Get the number of samples
    pub fn sample_count(&self) -> usize {
        self.samples.len()
    }

    /// Check if waveform is empty
    pub fn is_empty(&self) -> bool {
        self.samples.is_empty()
    }

    /// Get sample at index (clamped to bounds)
    pub fn get_sample(&self, index: usize) -> Option<f32> {
        self.samples.get(index).copied()
    }

    /// Calculate amplitude in dB relative to full scale
    pub fn amplitude_db(&self) -> f32 {
        if self.rms_amplitude == 0.0 {
            return f32::NEG_INFINITY;
        }
        20.0 * self.rms_amplitude.log10()
    }

    /// Compute FFT spectrum of the waveform
    pub fn compute_spectrum(&self, sample_rate: f32, window: WindowType) -> Spectrum {
        let mut processor = FftProcessor::new();
        processor.compute_spectrum(&self.samples, sample_rate, window)
    }

    /// Compute spectrum with default Hann window
    pub fn spectrum(&self, sample_rate: f32) -> Spectrum {
        self.compute_spectrum(sample_rate, WindowType::Hann)
    }

    /// Analyze waveform and compute all measurements
    pub fn analyze(&self, sample_rate: f32) -> WaveformAnalysis {
        measurements::analyze_waveform(&self.samples, sample_rate)
    }

    /// Compute harmonic analysis
    pub fn analyze_harmonics(&self, sample_rate: f32) -> super::measurements::HarmonicAnalysis {
        measurements::analyze_harmonics(&self.samples, sample_rate)
    }

    /// Get zero crossing rate
    pub fn zero_crossing_rate(&self) -> f32 {
        measurements::zero_crossing_rate(&self.samples)
    }

    /// Estimate dominant frequency using zero-crossing
    pub fn estimate_frequency(&self, sample_rate: f32) -> f32 {
        measurements::estimate_dominant_frequency(&self.samples, sample_rate)
    }
}

/// Waveform data for real-time streaming (without persistence)
#[derive(Debug, Clone, PartialEq)]
pub struct WaveformStreamData {
    pub scope_id: String,
    pub samples: Vec<f32>,
    pub timestamp: DateTime<Utc>,
    pub sample_rate: u32,
}

impl WaveformStreamData {
    /// Create new streaming waveform data
    pub fn new(scope_id: String, samples: Vec<f32>, sample_rate: u32) -> Self {
        Self {
            scope_id,
            samples,
            timestamp: Utc::now(),
            sample_rate,
        }
    }

    /// Get duration in milliseconds
    pub fn duration_ms(&self) -> f64 {
        self.samples.len() as f64 / self.sample_rate as f64 * 1000.0
    }

    /// Convert to persistent Waveform
    pub fn into_waveform(self, id: String) -> Waveform {
        Waveform::with_duration(
            id,
            self.scope_id,
            self.samples,
            self.timestamp,
            self.sample_rate as f64,
        )
    }

    /// Compute spectrum for streaming data
    pub fn spectrum(&self) -> Spectrum {
        let mut processor = FftProcessor::new();
        processor.compute_spectrum(&self.samples, self.sample_rate as f32, WindowType::Hann)
    }

    /// Analyze streaming waveform
    pub fn analyze(&self) -> WaveformAnalysis {
        measurements::analyze_waveform(&self.samples, self.sample_rate as f32)
    }
}
