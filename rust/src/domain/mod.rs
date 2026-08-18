#[allow(unused_imports)]
pub mod entity_capture;
pub mod entity_dashboard_summary;
pub mod entity_session;
pub mod entity_settings;
pub mod entity_user_preferences;
pub mod entity_waveform;

pub mod trait_audio_capture;
pub mod trait_session_repository;
pub mod trait_settings_repository;
pub mod trait_user_preferences_repository;
pub mod trait_waveform_repository;

pub mod error_domain;

pub mod valueobject_amplitude;
pub mod valueobject_frequency;
pub mod valueobject_timerange;
pub mod valueobject_timescale;

// DSP types (pure-data DTOs) live in `dsp_types`; the algorithms are in the
// C++ core, reached via `infrastructure::dsp_ffi`. The deleted Rust modules
// (`fft_processor`, `measurements`, `spectrogram`, `compression`, `trigger`,
// `waveform_generators`) are replaced by those two.
pub mod dsp_types;

pub mod recording;

#[allow(unused_imports)]
pub use entity_capture::Capture;
#[allow(unused_imports)]
pub use entity_dashboard_summary::{DashboardSummary, RecentScope};
pub use entity_session::Session;
pub use entity_settings::{Settings, TriggerEdge, TriggerMode};
pub use entity_user_preferences::UserPreferences;
#[allow(unused_imports)]
pub use entity_waveform::{Waveform, WaveformStreamData};
pub use trait_audio_capture::AudioDevice;
pub use trait_user_preferences_repository::UserPreferencesRepository;

pub use error_domain::{DomainError, DomainResult};

// DSP type re-exports — shapes unchanged, now defined in `dsp_types`.
pub use dsp_types::{
    FrequencyComponent, HarmonicAnalysis, SpectrogramConfig, SpectrogramData, Spectrum,
    WaveformAnalysis, WindowType, format_db, format_dbfs, format_snr, format_thd,
};
// DSP algorithm re-exports — now backed by the C++ core via `dsp_ffi`.
// Callers that wrote `crate::domain::analyze_waveform(...)` keep compiling.
pub use crate::infrastructure::dsp_ffi::{
    FftProcessor, amplitude_to_db, analyze_harmonics, analyze_waveform, compress_waveform,
    compute_dc_offset, compute_rms, crest_factor_db, db_to_amplitude, dbfs_to_amplitude,
    decompress_waveform, estimate_dominant_frequency, find_negative_peak_amplitude,
    find_peak_amplitude, peak_to_dbfs, rms_to_dbfs, snr_to_db, zero_crossing_rate,
};

pub use recording::{
    Recording, RecordingFilter, RecordingStats, RecordingSummary, ScopeStatus, ScopeStatusCounts,
    SessionWithStatus,
};
