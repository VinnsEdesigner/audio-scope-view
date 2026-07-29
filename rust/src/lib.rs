
pub mod api;
pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod shared;

// Re-export commonly used types
pub use application::{DashboardService, SessionService, SettingsService, WaveformService};
pub use domain::{AudioDevice, DashboardSummary, Session, Settings, Waveform};
pub use infrastructure::{AudioBackendType, AudioStreamManager, AppConfig, DatabaseConnection, StreamConfig};
