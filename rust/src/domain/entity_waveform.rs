#![allow(dead_code)]
use chrono::{DateTime, Utc};

// DSP types + algorithms now come from the C++ core via FFI. The struct
// definitions are in `domain::dsp_types`; the functions are re-exported at
// `domain` level (see domain/mod.rs) so the old call sites keep working.
use super::dsp_types::{HarmonicAnalysis, Spectrum, WaveformAnalysis, WindowType};
use super::{
    FftProcessor, analyze_harmonics, analyze_waveform, estimate_dominant_frequency,
    zero_crossing_rate,
};

#[derive(Debug, Clone, PartialEq)]
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
    pub fn new(
        id: String,
        session_id: String,
        samples: Vec<f32>,
        timestamp: DateTime<Utc>,
    ) -> Self {
        let peak_amplitude = Self::calculate_peak(&samples);
        let rms_amplitude = Self::calculate_rms(&samples);
        let duration_ms = samples.len() as f64 / 44.1;
        Self {
            id,
            session_id,
            samples,
            timestamp,
            duration_ms,
            peak_amplitude,
            rms_amplitude,
        }
    }

    pub fn with_duration(
        id: String,
        session_id: String,
        samples: Vec<f32>,
        timestamp: DateTime<Utc>,
        sample_rate: f64,
    ) -> Self {
        let peak_amplitude = Self::calculate_peak(&samples);
        let rms_amplitude = Self::calculate_rms(&samples);
        let duration_ms = samples.len() as f64 / sample_rate * 1000.0;

        Self {
            id,
            session_id,
            samples,
            timestamp,
            duration_ms,
            peak_amplitude,
            rms_amplitude,
        }
    }

    fn calculate_peak(samples: &[f32]) -> f32 {
        samples
            .iter()
            .map(|s| s.abs())
            .fold(0.0f32, |max, s| if s > max { s } else { max })
    }

    fn calculate_rms(samples: &[f32]) -> f32 {
        if samples.is_empty() {
            return 0.0;
        }
        let sum_squares: f32 = samples.iter().map(|s| s * s).sum();
        (sum_squares / samples.len() as f32).sqrt()
    }

    pub fn sample_count(&self) -> usize {
        self.samples.len()
    }

    pub fn is_empty(&self) -> bool {
        self.samples.is_empty()
    }

    pub fn get_sample(&self, index: usize) -> Option<f32> {
        self.samples.get(index).copied()
    }

    pub fn amplitude_db(&self) -> f32 {
        if self.rms_amplitude == 0.0 {
            return f32::NEG_INFINITY;
        }
        20.0 * self.rms_amplitude.log10()
    }

    pub fn compute_spectrum(&self, sample_rate: f32, window: WindowType) -> Spectrum {
        let mut processor = FftProcessor::new();
        processor.compute_spectrum(&self.samples, sample_rate, window)
    }

    pub fn spectrum(&self, sample_rate: f32) -> Spectrum {
        self.compute_spectrum(sample_rate, WindowType::Hann)
    }

    pub fn analyze(&self, sample_rate: f32) -> WaveformAnalysis {
        analyze_waveform(&self.samples, sample_rate)
    }

    pub fn analyze_harmonics(&self, sample_rate: f32) -> HarmonicAnalysis {
        analyze_harmonics(&self.samples, sample_rate)
    }

    pub fn zero_crossing_rate(&self) -> f32 {
        zero_crossing_rate(&self.samples)
    }

    pub fn estimate_frequency(&self, sample_rate: f32) -> f32 {
        estimate_dominant_frequency(&self.samples, sample_rate)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct WaveformStreamData {
    pub session_id: String,
    pub samples: Vec<f32>,
    pub timestamp: DateTime<Utc>,
    pub sample_rate: u32,
}

impl WaveformStreamData {
    pub fn new(session_id: String, samples: Vec<f32>, sample_rate: u32) -> Self {
        Self {
            session_id,
            samples,
            timestamp: Utc::now(),
            sample_rate,
        }
    }

    pub fn duration_ms(&self) -> f64 {
        self.samples.len() as f64 / self.sample_rate as f64 * 1000.0
    }

    pub fn into_waveform(self, id: String) -> Waveform {
        Waveform::with_duration(
            id,
            self.session_id,
            self.samples,
            self.timestamp,
            self.sample_rate as f64,
        )
    }

    pub fn spectrum(&self) -> Spectrum {
        let mut processor = FftProcessor::new();
        processor.compute_spectrum(&self.samples, self.sample_rate as f32, WindowType::Hann)
    }

    pub fn analyze(&self) -> WaveformAnalysis {
        analyze_waveform(&self.samples, self.sample_rate as f32)
    }
}
