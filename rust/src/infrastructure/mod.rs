pub mod audio_capture_real;
pub mod audio_stream_manager;
pub mod config_loader;
pub mod database_connection;
pub mod database_migrations;
pub mod dsp_ffi;
pub mod repo_sqlite_api_key;
pub mod repo_sqlite_recording;
pub mod repo_sqlite_session;
pub mod repo_sqlite_settings;
pub mod repo_sqlite_user_preferences;
pub mod repo_sqlite_waveform;
pub mod repo_trait_api_key;
pub mod repo_trait_recording;
pub mod repo_trait_session;
pub mod repo_turso_api_key;
pub mod repo_turso_recording;
pub mod repo_turso_session;
pub mod repo_turso_settings;
pub mod repo_turso_user_preferences;
pub mod repo_turso_waveform;
pub mod turso_http_client;

// Android on-device storage backend — compiled only when the `android` Cargo
// feature is on (cross-compiling for the mobile app). Off by default, so
// desktop/server builds carry no Android storage code.
#[cfg(feature = "android")]
pub mod android;
#[cfg(feature = "android")]
pub use android::{build_app_state, connect as connect_android, database_path as android_database_path, is_selected as is_android_selected};

pub use audio_capture_real::RealAudioCapture;
pub use audio_stream_manager::{
    AudioBackendType, AudioStreamEvent, AudioStreamManager, StreamConfig, StreamStats,
};
pub use config_loader::AppConfig;
pub use database_connection::DatabaseConnection;
pub use repo_sqlite_api_key::SqliteApiKeyRepository;
pub use repo_sqlite_recording::SqliteRecordingRepository;
pub use repo_sqlite_session::SqliteSessionRepository;
pub use repo_sqlite_settings::SqliteSettingsRepository;
pub use repo_sqlite_user_preferences::SqliteUserPreferencesRepository;
pub use repo_sqlite_waveform::SqliteWaveformRepository;
pub use repo_trait_api_key::ApiKeyRepository;
pub use repo_trait_recording::RecordingRepository;
pub use repo_trait_session::SessionRepository;
pub use repo_turso_api_key::TursoApiKeyRepository;
pub use repo_turso_recording::TursoRecordingRepository;
pub use repo_turso_session::TursoSessionRepository;
pub use repo_turso_settings::TursoSettingsRepository;
pub use repo_turso_user_preferences::TursoUserPreferencesRepository;
pub use repo_turso_waveform::TursoWaveformRepository;
pub use turso_http_client::TursoClient;
