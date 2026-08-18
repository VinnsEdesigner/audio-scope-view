//! Android on-device storage backend.
//!
//! This is the third storage backend, alongside the existing local SQLite
//! (`repo_sqlite_*`) and Turso (`repo_turso_*`) backends. It is compiled only
//! when the `android` Cargo feature is on — i.e. when cross-compiling the
//! crate for Android so the mobile app can link the Rust server in-process.
//! Desktop/server builds leave this module out entirely, so they carry no
//! Android storage code.
//!
//! Why a distinct backend when Android storage *is* SQLite? On Android the
//! Rust server runs in-process inside the app (no standalone `main()` /
//! TCP socket), the DB file must live in the app's internal storage (a path
//! the app supplies, not known at compile time), and the whole stack is
//! selected by an env var only relevant on-device. This module owns those
//! differences; the per-entity repositories themselves are reused from
//! `repo_sqlite_*` (they already target `sqlx::SqlitePool`).
//!
//! Selection: `ASV_STORAGE_BACKEND=android` picks this backend at runtime.
//! DB path: `ASV_ANDROID_DB_PATH` (default
//! `/data/data/dev.vinns.vyzorix/files/audioscope.db` — the app's internal
//! storage, writable without extra permissions).

#![cfg(feature = "android")]

use std::sync::Arc;

use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;
use tracing::info;

use crate::api::auth::ApiKeyStore;
use crate::api::server_graphql::AppState;
use crate::application::{
    BatchCaptureService, DashboardService, RecordingService, SessionService, SettingsService,
    SimulationService, WaveformService,
};
use crate::domain::trait_settings_repository::SettingsRepository;
use crate::domain::trait_user_preferences_repository::UserPreferencesRepository;
use crate::domain::trait_waveform_repository::WaveformRepository;
use crate::infrastructure::database_migrations::run_migrations;
use crate::infrastructure::repo_sqlite_api_key::SqliteApiKeyRepository;
use crate::infrastructure::repo_sqlite_recording::SqliteRecordingRepository;
use crate::infrastructure::repo_sqlite_session::SqliteSessionRepository;
use crate::infrastructure::repo_sqlite_settings::SqliteSettingsRepository;
use crate::infrastructure::repo_sqlite_user_preferences::SqliteUserPreferencesRepository;
use crate::infrastructure::repo_sqlite_waveform::SqliteWaveformRepository;
use crate::infrastructure::repo_trait_api_key::ApiKeyRepository;
use crate::infrastructure::repo_trait_recording::RecordingRepository;
use crate::infrastructure::repo_trait_session::SessionRepository;
use crate::infrastructure::AudioStreamManager;
use crate::shared::error_app::{AppError, AppResult};

/// Default on-device DB location: the vyzorix app's internal storage, which
/// is writable without extra permissions and wiped on uninstall. Overridable
/// via `ASV_ANDROID_DB_PATH`.
const DEFAULT_ANDROID_DB_PATH: &str =
    "/data/data/dev.vinns.vyzorix/files/audioscope.db";

/// True when the Android backend is selected at runtime. The `android` Cargo
/// feature must also be on (it gates compilation of this module); this env
/// check is the runtime selector so a single binary with the feature enabled
/// can still fall back to the server backends if desired.
pub fn is_selected() -> bool {
    matches!(
        std::env::var("ASV_STORAGE_BACKEND").ok().as_deref(),
        Some("android")
    )
}

/// Resolve the on-device SQLite file path from `ASV_ANDROID_DB_PATH`,
/// falling back to the app's internal storage.
pub fn database_path() -> String {
    std::env::var("ASV_ANDROID_DB_PATH")
        .ok()
        .filter(|p| !p.is_empty())
        .unwrap_or_else(|| DEFAULT_ANDROID_DB_PATH.to_string())
}

/// Open a `SqlitePool` against the on-device DB file and apply migrations.
/// The parent directory is created if missing (the app's `files` dir may not
/// exist yet on first launch).
pub async fn connect() -> AppResult<SqlitePool> {
    let path = database_path();
    if let Some(parent) = std::path::Path::new(&path).parent()
        && !parent.as_os_str().is_empty()
    {
        std::fs::create_dir_all(parent).ok();
    }
    let url = format!("sqlite:{}?mode=rwc", path);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .min_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(30))
        .connect(&url)
        .await
        .map_err(|e| AppError::database(&format!("Failed to create Android SQLite pool: {}", e)))?;

    run_migrations(&pool).await?;
    info!("Android on-device SQLite ready at {}", path);
    Ok(pool)
}

/// Bootstrap the full server stack against the on-device SQLite, returning
/// an in-process `AppState` the Android JNI layer drives directly (no TCP
/// socket). Mirrors `main.rs`'s repository + service wiring, but every
/// repository is the SQLite impl pointed at the local file — the mobile app
/// is its own single-tenant server.
#[allow(dead_code)]
pub async fn build_app_state(bootstrap_key: String) -> AppResult<Arc<AppState>> {
    let pool = connect().await?;

    info!("Using Android (on-device SQLite) repositories");
    let scope_repo = Arc::new(SqliteSessionRepository::new(pool.clone())) as Arc<dyn SessionRepository>;
    let settings_repo =
        Arc::new(SqliteSettingsRepository::new(pool.clone())) as Arc<dyn SettingsRepository>;
    let waveform_repo =
        Arc::new(SqliteWaveformRepository::new(pool.clone())) as Arc<dyn WaveformRepository>;
    let recording_repo =
        Arc::new(SqliteRecordingRepository::new(pool.clone())) as Arc<dyn RecordingRepository>;
    let api_key_repo =
        Arc::new(SqliteApiKeyRepository::new(pool.clone())) as Arc<dyn ApiKeyRepository>;
    let user_prefs_repo = Arc::new(SqliteUserPreferencesRepository::new(pool.clone()))
        as Arc<dyn UserPreferencesRepository>;

    let scope_service = Arc::new(SessionService::new(scope_repo.clone()));
    let settings_service = Arc::new(SettingsService::new(
        settings_repo.clone(),
        scope_repo.clone(),
    ));
    let dashboard_service = Arc::new(DashboardService::new(
        scope_repo.clone(),
        waveform_repo.clone(),
    ));
    let waveform_service = Arc::new(WaveformService::new(waveform_repo.clone()));
    let recording_service = Arc::new(RecordingService::new(recording_repo, scope_repo.clone()));
    let simulation_service = Arc::new(SimulationService::new(waveform_service.clone()));
    let batch_capture_service = Arc::new(BatchCaptureService::new(waveform_service.clone()));

    let audio_manager = Arc::new(AudioStreamManager::with_backend(
        crate::infrastructure::AudioBackendType::Real,
    ));

    let key_store = Arc::new(ApiKeyStore::with_repository(api_key_repo.clone()));
    key_store.load_from_database().await;

    Ok(Arc::new(AppState::new(
        scope_service,
        settings_service,
        dashboard_service,
        waveform_service,
        recording_service,
        simulation_service,
        batch_capture_service,
        bootstrap_key,
        key_store,
        user_prefs_repo,
        audio_manager,
    )))
}
