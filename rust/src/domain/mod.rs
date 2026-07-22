//! Domain layer - Core business logic and entities
//!
//! This layer contains pure business logic with no external dependencies.
//! Dependencies flow inward: Data → Domain ← Presentation ← API

#[allow(unused_imports)]
pub mod entity_capture;
pub mod entity_dashboard_summary;
pub mod entity_scope;
pub mod entity_settings;
pub mod entity_waveform;

pub mod trait_audio_capture;
pub mod trait_scope_repository;
pub mod trait_settings_repository;
pub mod trait_waveform_repository;

pub mod error_domain;

pub mod valueobject_amplitude;
pub mod valueobject_frequency;
pub mod valueobject_timerange;
pub mod valueobject_timescale;

// Audio processing modules
pub mod compression;
pub mod fft_processor;
pub mod measurements;
pub mod spectrogram;
pub mod waveform_generators;

// Trigger system
pub mod trigger;

#[allow(unused_imports)]
pub use entity_capture::Capture;
#[allow(unused_imports)]
pub use entity_dashboard_summary::{DashboardSummary, RecentScope};
pub use entity_scope::Scope;
pub use entity_settings::{Settings, TriggerEdge, TriggerMode};
#[allow(unused_imports)]
pub use entity_waveform::{Waveform, WaveformStreamData};
pub use trait_audio_capture::AudioDevice;

pub use error_domain::{DomainError, DomainResult};

// Audio processing exports
pub use fft_processor::{FftProcessor, Spectrum, WindowType};
pub use measurements::{
    FrequencyComponent, HarmonicAnalysis, WaveformAnalysis, analyze_harmonics, analyze_waveform,
    compute_dc_offset, compute_rms, find_peak_amplitude, zero_crossing_rate,
};
pub use spectrogram::{SpectrogramConfig, SpectrogramData, SpectrogramProcessor};
