
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

pub mod compression;
pub mod fft_processor;
pub mod measurements;
pub mod spectrogram;
pub mod waveform_generators;

pub mod trigger;

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

pub use fft_processor::{FftProcessor, Spectrum, WindowType};
pub use measurements::{
    FrequencyComponent, HarmonicAnalysis, WaveformAnalysis, analyze_harmonics, analyze_waveform,
    compute_dc_offset, compute_rms, find_peak_amplitude, zero_crossing_rate,
    amplitude_to_db, db_to_amplitude, peak_to_dbfs, rms_to_dbfs, dbfs_to_amplitude,
    format_db, format_dbfs, crest_factor_db, snr_to_db,
};
pub use spectrogram::{SpectrogramConfig, SpectrogramData, SpectrogramProcessor};

pub use recording::{Recording, RecordingSummary, RecordingStats, RecordingFilter, ScopeStatus, SessionWithStatus, ScopeStatusCounts};