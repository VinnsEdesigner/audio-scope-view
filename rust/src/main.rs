#[allow(unused_imports)]
mod api;
#[allow(unused_imports)]
mod application;
#[allow(unused_imports)]
mod domain;
#[allow(unused_imports)]
mod infrastructure;
#[allow(unused_imports)]
mod shared;

use std::sync::Arc;
use std::time::Duration;

use tokio::sync::mpsc;
use tokio::time::interval;
use tracing::{error, info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use api::auth::ApiKeyStore;
use api::schema_subscription::{AudioStats, SpectrumData, WaveformData};
use api::server_graphql::{AppState, start_server};
use application::{
    BatchCaptureService, DashboardService, RecordingService, SessionService, SettingsService,
    SimulationService, WaveformService,
};
use domain::trait_settings_repository::SettingsRepository;
use domain::trait_user_preferences_repository::UserPreferencesRepository;
use domain::trait_waveform_repository::WaveformRepository;
use infrastructure::{
    AudioStreamEvent, AudioStreamManager, config_loader::AppConfig,
    database_connection::DatabaseConnection, database_migrations::run_migrations,
    repo_sqlite_api_key::SqliteApiKeyRepository, repo_sqlite_recording::SqliteRecordingRepository,
    repo_sqlite_session::SqliteSessionRepository, repo_sqlite_settings::SqliteSettingsRepository,
    repo_sqlite_user_preferences::SqliteUserPreferencesRepository,
    repo_sqlite_waveform::SqliteWaveformRepository, repo_trait_api_key::ApiKeyRepository,
    repo_trait_recording::RecordingRepository, repo_trait_session::SessionRepository,
    repo_turso_api_key::TursoApiKeyRepository, repo_turso_recording::TursoRecordingRepository,
    repo_turso_session::TursoSessionRepository, repo_turso_settings::TursoSettingsRepository,
    repo_turso_user_preferences::TursoUserPreferencesRepository,
    repo_turso_waveform::TursoWaveformRepository, turso_http_client::TursoClient,
};

async fn audio_event_processor(
    mut event_receiver: mpsc::Receiver<AudioStreamEvent>,
    ws_state: Arc<api::websocket::handler::WsState>,
) {
    while let Some(event) = event_receiver.recv().await {
        match event {
            AudioStreamEvent::Waveform {
                session_id,
                samples,
                timestamp_ms,
                sample_rate,
            } => {
                let peak = samples.iter().fold(0.0f32, |max, &s| max.max(s.abs()));
                let rms = (samples.iter().map(|&s| s * s).sum::<f32>()
                    / samples.len().max(1) as f32)
                    .sqrt();

                let waveform_data = WaveformData {
                    session_id: session_id.clone(),
                    samples: samples.clone(),
                    timestamp: timestamp_ms,
                    sample_rate,
                    peak_amplitude: peak,
                    rms_amplitude: rms,
                };

                ws_state
                    .broadcast_to_graphql_waveform(&session_id, waveform_data)
                    .await;

                // Compute full DSP analysis (FFT + harmonics) from the
                // server-captured audio and publish it to the
                // `analysisSubscribe` GraphQL subscription, so clients receive
                // server-side metrics without having to push their own audio.
                let sample_rate_f = sample_rate as f32;
                let waveform_analysis = crate::domain::analyze_waveform(&samples, sample_rate_f);
                let harmonic_analysis = crate::domain::analyze_harmonics(&samples, sample_rate_f);

                let harmonics: Vec<crate::api::schema_subscription::HarmonicComponent> =
                    harmonic_analysis
                        .harmonics
                        .iter()
                        .take(10)
                        .map(|h| crate::api::schema_subscription::HarmonicComponent {
                            harmonic: h.harmonic as i32,
                            frequency: h.frequency,
                            magnitude: h.magnitude,
                            phase: h.phase,
                        })
                        .collect();

                let analysis_data = crate::api::schema_subscription::AnalysisResult {
                    session_id: session_id.clone(),
                    timestamp: timestamp_ms,
                    sample_rate,
                    peak_amplitude: waveform_analysis.peak_amplitude,
                    rms_amplitude: waveform_analysis.rms_amplitude,
                    dc_offset: waveform_analysis.dc_offset,
                    dominant_frequency: waveform_analysis.dominant_frequency,
                    fundamental_frequency: harmonic_analysis.fundamental.frequency,
                    thd: waveform_analysis.thd,
                    thdn: harmonic_analysis.thdn,
                    snr: waveform_analysis.snr,
                    crest_factor: waveform_analysis.crest_factor,
                    signal_energy: harmonic_analysis.signal_energy,
                    noise_energy: harmonic_analysis.noise_energy,
                    harmonics,
                };

                ws_state
                    .broadcast_to_graphql_analysis(&session_id, analysis_data)
                    .await;
            }
            AudioStreamEvent::Spectrum {
                session_id,
                frequencies,
                magnitudes,
                timestamp_ms,
            } => {
                let spectrum_data = SpectrumData {
                    session_id: session_id.clone(),
                    frequencies,
                    magnitudes: magnitudes.clone(),
                    timestamp: timestamp_ms,
                };

                ws_state
                    .broadcast_to_graphql_spectrum(&session_id, spectrum_data)
                    .await;
            }
            AudioStreamEvent::DeviceDisconnected { session_id, reason } => {
                warn!(
                    "Audio device disconnected for scope {}: {}",
                    session_id, reason
                );
            }
            AudioStreamEvent::Error {
                session_id,
                message,
            } => {
                error!("Audio error for scope {}: {}", session_id, message);
            }
            AudioStreamEvent::CaptureStarted {
                session_id,
                sample_rate,
            } => {
                info!(
                    "Capture started for scope {} at {} Hz",
                    session_id, sample_rate
                );
            }
            AudioStreamEvent::CaptureStopped { session_id } => {
                info!("Capture stopped for scope {}", session_id);
            }
        }
    }

    warn!("Audio event processor stopped");
}

/// Pumps the AudioStreamManager capture loop: while any session is capturing,
/// repeatedly reads samples from the cpal backend and dispatches them as
/// `AudioStreamEvent`s (which `audio_event_processor` turns into waveform /
/// analysis broadcasts). Without this loop the capture backend is opened but
/// never read, so no events are emitted.
async fn capture_pump_loop(stream_manager: Arc<AudioStreamManager>) {
    let mut ticker = interval(Duration::from_millis(50));
    loop {
        ticker.tick().await;
        if !stream_manager.is_any_capturing().await {
            continue;
        }
        if let Err(e) = stream_manager.read_and_process().await {
            warn!("capture_pump_loop read_and_process error: {:?}", e);
        }
    }
}

async fn stats_reporter(
    stream_manager: Arc<AudioStreamManager>,
    ws_state: Arc<api::websocket::handler::WsState>,
    interval_secs: u64,
) {
    let mut ticker = interval(Duration::from_secs(interval_secs));

    loop {
        ticker.tick().await;

        let active_sessions = stream_manager.active_sessions().await;

        for session_id in active_sessions {
            if let Some(stats) = stream_manager.get_session_stats(&session_id).await {
                let samples_per_second = stats
                    .samples_captured
                    .checked_mul(1000)
                    .and_then(|v| v.checked_div(stats.capture_duration_ms))
                    .unwrap_or(0) as u32;

                let audio_stats = AudioStats {
                    session_id: session_id.clone(),
                    samples_per_second,
                    dropped_samples: stats.errors,
                    buffer_fill_percent: 0.0,
                    capture_duration_ms: stats.capture_duration_ms,
                    is_capturing: stream_manager.is_any_capturing().await,
                };

                ws_state
                    .broadcast_to_graphql_stats(&session_id, audio_stats)
                    .await;
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "audio_scope_view=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting Audio Scope View Server...");

    let config = AppConfig::load().unwrap_or_default();

    // Create data directory for local SQLite development
    if config.database.url.starts_with("sqlite:")
        && !config.database.url.contains(":memory:")
        && let Some(path) = config.database.url.strip_prefix("sqlite:")
    {
        let db_path = path.split('?').next().unwrap_or(path);
        if let Some(parent) = std::path::Path::new(db_path).parent()
            && !parent.as_os_str().is_empty()
        {
            std::fs::create_dir_all(parent).ok();
            info!("Ensured data directory exists: {:?}", parent);
        }
    }

    let bootstrap_key = std::env::var("BOOTSTRAP_KEY")
        .ok()
        .filter(|k| !k.is_empty())
        .unwrap_or_else(|| config.security.bootstrap_key.clone());

    if bootstrap_key.is_empty() {
        eprintln!("BOOTSTRAP_KEY environment variable is required. Exiting.");
        std::process::exit(1);
    }

    if bootstrap_key.len() < 16 {
        eprintln!("BOOTSTRAP_KEY must be at least 16 characters. Exiting.");
        std::process::exit(1);
    }

    let db = DatabaseConnection::new(&config.database.url).await?;

    // Android in-process path: when the crate is built with the `android`
    // feature AND `ASV_STORAGE_BACKEND=android` is set, use the on-device
    // SQLite backend (app internal storage) instead of the configured URL.
    // On desktop/server builds (feature off) this branch is absent.
    #[cfg(feature = "android")]
    let db = {
        if crate::infrastructure::is_android_selected() {
            info!("ASV_STORAGE_BACKEND=android — using on-device Android SQLite");
            let pool = crate::infrastructure::connect_android().await?;
            DatabaseConnection::Sqlite(pool)
        } else {
            db
        }
    };

    // Run migrations
    match &db {
        DatabaseConnection::Sqlite(pool) => {
            run_migrations(pool).await?;
        }
        DatabaseConnection::Turso { .. } => {
            // Run migrations for Turso using HTTP API
            info!("Running migrations for Turso database...");
            for migration in infrastructure::database_migrations::MIGRATIONS {
                info!(
                    "Applying migration v{}: {}",
                    migration.version, migration.name
                );
                db.execute_raw(migration.sql)
                    .await
                    .map_err(|e| format!("Failed to apply migration {}: {}", migration.name, e))?;
            }
            info!("Migrations complete");
        }
    }

    // Repository wiring: SQLite (local) or Turso (cloud) for ALL repositories
    let scope_repo: Arc<dyn SessionRepository>;
    let settings_repo: Arc<dyn SettingsRepository>;
    let waveform_repo: Arc<dyn WaveformRepository>;
    let recording_repo: Arc<dyn RecordingRepository>;
    let api_key_repo: Arc<dyn ApiKeyRepository>;
    let user_prefs_repo: Arc<dyn UserPreferencesRepository>;

    match &db {
        DatabaseConnection::Sqlite(pool) => {
            info!("Using SQLite repositories");
            scope_repo =
                Arc::new(SqliteSessionRepository::new(pool.clone())) as Arc<dyn SessionRepository>;
            settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()))
                as Arc<dyn SettingsRepository>;
            waveform_repo = Arc::new(SqliteWaveformRepository::new(pool.clone()))
                as Arc<dyn WaveformRepository>;
            recording_repo = Arc::new(SqliteRecordingRepository::new(pool.clone()))
                as Arc<dyn RecordingRepository>;
            api_key_repo =
                Arc::new(SqliteApiKeyRepository::new(pool.clone())) as Arc<dyn ApiKeyRepository>;
            user_prefs_repo = Arc::new(SqliteUserPreferencesRepository::new(pool.clone()))
                as Arc<dyn UserPreferencesRepository>;
        }
        DatabaseConnection::Turso { url, token } => {
            info!("Using Turso repositories for all entities");
            let client = TursoClient::new(url, token);
            let client2 = TursoClient::new(url, token);
            let client3 = TursoClient::new(url, token);
            let client4 = TursoClient::new(url, token);
            let client5 = TursoClient::new(url, token);
            let client6 = TursoClient::new(url, token);

            scope_repo =
                Arc::new(TursoSessionRepository::new(client)) as Arc<dyn SessionRepository>;
            settings_repo =
                Arc::new(TursoSettingsRepository::new(client2)) as Arc<dyn SettingsRepository>;
            waveform_repo =
                Arc::new(TursoWaveformRepository::new(client3)) as Arc<dyn WaveformRepository>;
            recording_repo =
                Arc::new(TursoRecordingRepository::new(client4)) as Arc<dyn RecordingRepository>;
            api_key_repo =
                Arc::new(TursoApiKeyRepository::new(client5)) as Arc<dyn ApiKeyRepository>;
            user_prefs_repo = Arc::new(TursoUserPreferencesRepository::new(client6))
                as Arc<dyn UserPreferencesRepository>;
        }
    }

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

    let audio_backend = config.audio.backend_type();
    info!("Audio backend (configured): {:?}", audio_backend);
    let audio_manager = Arc::new(AudioStreamManager::with_backend(audio_backend));
    info!("Audio backend (active): {:?}", audio_manager.backend_type());
    match audio_manager.list_devices().await {
        Ok(devices) => {
            for device in &devices {
                let default_marker = if device.is_default { " [DEFAULT]" } else { "" };
                info!(
                    "Audio device: {} ({} ch, {} Hz){}",
                    device.name, device.channels, device.sample_rate, default_marker
                );
            }
        }
        Err(e) => {
            warn!("Could not enumerate audio devices: {}", e);
        }
    }

    let (event_tx, event_rx) = mpsc::channel::<AudioStreamEvent>(100);
    audio_manager.set_event_sender(event_tx).await;

    let key_store = Arc::new(ApiKeyStore::with_repository(api_key_repo.clone()));
    key_store.load_from_database().await;

    let state = Arc::new(AppState::new(
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
        audio_manager.clone(),
    ));

    // Use the SAME `WsState` instance that `AppState` injects into the GraphQL
    // context. A separately-created `WsState` here would desynchronize the
    // event processor's broadcast map from the subscription resolvers' map, so
    // `analysisSubscribe`/`waveformSubscribe` would never receive data.
    let ws_state = state.ws_state();

    let ws_state_clone = ws_state.clone();
    let _processor_handle = tokio::spawn(async move {
        audio_event_processor(event_rx, ws_state_clone).await;
    });

    let audio_manager_clone = audio_manager.clone();
    let ws_state_stats = ws_state.clone();
    let _stats_handle = tokio::spawn(async move {
        stats_reporter(audio_manager_clone, ws_state_stats, 1).await;
    });

    // Pump the cpal capture loop so server-captured audio is read and
    // dispatched as waveform/analysis events while sessions are capturing.
    let audio_manager_pump = audio_manager.clone();
    let _pump_handle = tokio::spawn(async move {
        capture_pump_loop(audio_manager_pump).await;
    });

    let address = config.server_address();
    info!("GraphQL endpoint: http://{}/graphql", address);
    info!("Health: http://{}/health", address);
    if let Err(e) = start_server(&address, state).await {
        error!("Server error: {}", e);
    }

    audio_manager.shutdown().await;
    _processor_handle.abort();
    _stats_handle.abort();
    _pump_handle.abort();

    Ok(())
}
