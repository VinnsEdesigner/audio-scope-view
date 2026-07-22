
pub mod audio_capture_alsa;
pub mod audio_capture_mock;
pub mod audio_capture_pulse;
#[cfg(feature = "real-audio")]
pub mod audio_capture_real;
pub mod audio_stream_manager;
pub mod config_loader;
pub mod database_connection;
pub mod database_migrations;
pub mod repo_sqlite_scope;
pub mod repo_sqlite_settings;
pub mod repo_sqlite_waveform;

pub use audio_capture_mock::MockAudioCapture;
#[cfg(feature = "real-audio")]
pub use audio_capture_real::RealAudioCapture;
pub use audio_stream_manager::{AudioBackendType, AudioStreamEvent, AudioStreamManager, StreamConfig, StreamStats};
pub use config_loader::AppConfig;
pub use database_connection::DatabaseConnection;
pub use repo_sqlite_scope::SqliteScopeRepository;
pub use repo_sqlite_settings::SqliteSettingsRepository;
pub use repo_sqlite_waveform::SqliteWaveformRepository;
