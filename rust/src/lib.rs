pub mod api;
pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod shared;

pub use application::{DashboardService, SessionService, SettingsService, WaveformService};
pub use domain::{AudioDevice, DashboardSummary, Session, Settings, Waveform};
pub use infrastructure::{
    AppConfig, AudioBackendType, AudioStreamManager, DatabaseConnection, StreamConfig,
};

// Android in-process server entry. Only present when the `android` feature is
// on (cross-compiled for the mobile app). The Android JNI layer calls this to
// spin up the server stack against on-device SQLite — no separate binary, no
// TCP socket. See `src/infrastructure/android.rs`.
#[cfg(feature = "android")]
pub use infrastructure::{build_app_state as android_build_app_state, is_android_selected};
