//! Pure-data DSP DTOs — the Rust-side type definitions that the GraphQL schema,
//! entities, and websocket handlers use directly. The *algorithms* live in the
//! C++ core (called via `crate::infrastructure::dsp_ffi`); these structs are
//! just the data shapes the rest of the server holds and serializes.
//!
//! Moved here (unchanged field names/types) from the deleted `domain::fft_processor`,
//! `domain::measurements`, and `domain::spectrogram` modules so every existing
//! consumer compiles without changes to its `use` paths (they go through the
//! `domain` re-exports in `domain/mod.rs`).

// These DTOs + formatting helpers are the stable data surface re-exported by
// `domain`; fields are held for shape compatibility even when a specific
// resolver path doesn't read them yet.
#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// Window function. Field order matches the C++ `common::WindowType` enum
/// and the FFI `as_window_type` integer mapping.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum WindowType {
    Rectangular,
    #[default]
    Hann,
    Hamming,
    Blackman,
}

/// Full spectrum result. Shape-preserving (was `domain::fft_processor::Spectrum`).
#[derive(Debug, Clone)]
pub struct Spectrum {
    pub frequencies: Vec<f32>,
    pub magnitudes_db: Vec<f32>,
    pub phases: Option<Vec<f32>>,
    pub peak_frequency: f32,
    pub peak_magnitude_db: f32,
    pub sample_rate: f32,
    pub window_size: usize,
}

impl Default for Spectrum {
    fn default() -> Self {
        Self {
            frequencies: Vec::new(),
            magnitudes_db: Vec::new(),
            phases: None,
            peak_frequency: 0.0,
            peak_magnitude_db: -100.0,
            sample_rate: 44100.0,
            window_size: 0,
        }
    }
}

/// Time-domain analysis. Shape-preserving (was `domain::measurements::WaveformAnalysis`).
/// NOTE: the C++ core computes `thd` as a percent internally; the FFI converts
/// it back to a 0..1 fraction here to match the original Rust field semantics
/// (the GraphQL surface exposes it as `thd_percent` = `thd * 100`).
#[derive(Debug, Clone)]
pub struct WaveformAnalysis {
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
    pub dominant_frequency: f32,
    pub thd: f32,
    pub snr: f32,
    pub crest_factor: f32,
    pub dc_offset: f32,
}

impl Default for WaveformAnalysis {
    fn default() -> Self {
        Self {
            peak_amplitude: 0.0,
            rms_amplitude: 0.0,
            dominant_frequency: 0.0,
            thd: 0.0,
            snr: 0.0,
            crest_factor: 0.0,
            dc_offset: 0.0,
        }
    }
}

/// One harmonic component. Shape-preserving (was `domain::measurements::FrequencyComponent`).
#[derive(Debug, Clone)]
pub struct FrequencyComponent {
    pub frequency: f32,
    pub magnitude: f32,
    pub harmonic: u32,
    pub phase: f32,
}

/// Harmonic analysis result. Shape-preserving (was `domain::measurements::HarmonicAnalysis`).
#[derive(Debug, Clone)]
pub struct HarmonicAnalysis {
    pub fundamental: FrequencyComponent,
    pub harmonics: Vec<FrequencyComponent>,
    pub thd: f32,
    pub thdn: f32,
    pub signal_energy: f32,
    pub noise_energy: f32,
}

impl Default for HarmonicAnalysis {
    fn default() -> Self {
        Self {
            fundamental: FrequencyComponent {
                frequency: 0.0,
                magnitude: 0.0,
                harmonic: 1,
                phase: 0.0,
            },
            harmonics: Vec::new(),
            thd: 0.0,
            thdn: 0.0,
            signal_energy: 0.0,
            noise_energy: 0.0,
        }
    }
}

/// Spectrogram config. Shape-preserving (was `domain::spectrogram::SpectrogramConfig`).
#[derive(Debug, Clone)]
pub struct SpectrogramConfig {
    pub window_size: usize,
    pub overlap: usize,
    pub min_freq: f32,
    pub max_freq: f32,
}

impl Default for SpectrogramConfig {
    fn default() -> Self {
        Self {
            window_size: 1024,
            overlap: 512,
            min_freq: 0.0,
            max_freq: 22050.0,
        }
    }
}

impl SpectrogramConfig {
    pub fn with_window_size(mut self, size: usize) -> Self {
        self.window_size = size;
        self
    }
    pub fn with_overlap(mut self, overlap: usize) -> Self {
        self.overlap = overlap;
        self
    }
    pub fn with_frequency_range(mut self, min: f32, max: f32) -> Self {
        self.min_freq = min;
        self.max_freq = max;
        self
    }
}

/// Spectrogram data. Shape-preserving (was `domain::spectrogram::SpectrogramData`).
#[derive(Debug, Clone)]
pub struct SpectrogramData {
    pub frequencies: Vec<f32>,
    pub time_bins: Vec<i64>,
    pub magnitudes: Vec<Vec<f32>>,
    pub sample_rate: u32,
    pub window_size: usize,
    pub overlap: usize,
}

impl SpectrogramData {
    pub fn new(
        frequencies: Vec<f32>,
        time_bins: Vec<i64>,
        magnitudes: Vec<Vec<f32>>,
        sample_rate: u32,
        window_size: usize,
        overlap: usize,
    ) -> Self {
        Self {
            frequencies,
            time_bins,
            magnitudes,
            sample_rate,
            window_size,
            overlap,
        }
    }
}

// --------------------------------------------------------------------- //
// Display/formatting helpers (the Rust measurements.rs exposed these; kept here
// so the few callers that format dB strings keep compiling).
// --------------------------------------------------------------------- //

pub fn format_db(value_db: f32) -> String {
    if value_db == f32::NEG_INFINITY {
        "-∞ dB".to_string()
    } else {
        format!("{:.1} dB", value_db)
    }
}

pub fn format_dbfs(value_dbfs: f32) -> String {
    if value_dbfs == f32::NEG_INFINITY {
        "-∞ dBFS".to_string()
    } else {
        format!("{:.1} dBFS", value_dbfs)
    }
}

pub fn format_thd(thd: f32) -> String {
    format!("{:.2}%", thd * 100.0)
}

pub fn format_snr(snr: f32) -> String {
    format!("{:.1} dB", snr)
}
