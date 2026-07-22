
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
use api::server_graphql::{AppState, start_server};
use api::schema_subscription::{AudioStats, SpectrumData, WaveformData};
use application::{BatchCaptureService, DashboardService, ScopeService, SettingsService, SimulationService, WaveformService};
use infrastructure::{
    config_loader::AppConfig, database_connection::DatabaseConnection,
    database_migrations::run_migrations, repo_sqlite_scope::SqliteScopeRepository,
    repo_sqlite_settings::SqliteSettingsRepository, repo_sqlite_waveform::SqliteWaveformRepository,
    AudioStreamEvent, AudioStreamManager,
};

/// Audio event processing task
async fn audio_event_processor(
    mut event_receiver: mpsc::Receiver<AudioStreamEvent>,
    ws_state: Arc<api::websocket::handler::WsState>,
) {
    while let Some(event) = event_receiver.recv().await {
        match event {
            AudioStreamEvent::Waveform { 
                scope_id, 
                samples, 
                timestamp_ms, 
                sample_rate 
            } => {
                // Calculate amplitude metrics
                let peak = samples.iter().fold(0.0f32, |max, &s| max.max(s.abs()));
                let rms = (samples.iter().map(|&s| s * s).sum::<f32>() / samples.len() as f32).sqrt();
                
                let waveform_data = WaveformData {
                    scope_id: scope_id.clone(),
                    samples: samples.clone(),
                    timestamp: timestamp_ms,
                    sample_rate,
                    peak_amplitude: peak,
                    rms_amplitude: rms,
                };
                
                // Broadcast to GraphQL subscribers (waveform_subscribe)
                ws_state.broadcast_to_graphql_waveform(&scope_id, waveform_data).await;
            }
            AudioStreamEvent::Spectrum { 
                scope_id, 
                frequencies, 
                magnitudes, 
                timestamp_ms 
            } => {
                let spectrum_data = SpectrumData {
                    scope_id: scope_id.clone(),
                    frequencies,
                    magnitudes: magnitudes.clone(),
                    timestamp: timestamp_ms,
                };
                
                // Broadcast to GraphQL subscribers
                ws_state.broadcast_to_graphql_spectrum(&scope_id, spectrum_data).await;
            }
            AudioStreamEvent::DeviceDisconnected { scope_id, reason } => {
                warn!("Audio device disconnected for scope {}: {}", scope_id, reason);
            }
            AudioStreamEvent::Error { scope_id, message } => {
                error!("Audio error for scope {}: {}", scope_id, message);
            }
            AudioStreamEvent::CaptureStarted { scope_id, sample_rate } => {
                info!("Capture started for scope {} at {} Hz", scope_id, sample_rate);
            }
            AudioStreamEvent::CaptureStopped { scope_id } => {
                info!("Capture stopped for scope {}", scope_id);
            }
        }
    }
    
    warn!("Audio event processor stopped");
}

/// Statistics reporting task
async fn stats_reporter(
    stream_manager: Arc<AudioStreamManager>,
    ws_state: Arc<api::websocket::handler::WsState>,
    interval_secs: u64,
) {
    let mut ticker = interval(Duration::from_secs(interval_secs));
    
    loop {
        ticker.tick().await;
        
        let active_scopes = stream_manager.active_scopes();
        
        for scope_id in active_scopes {
            if let Some(stats) = stream_manager.get_scope_stats(&scope_id) {
                // Calculate samples per second from captured samples and duration
                let samples_per_second = stats.samples_captured
                    .checked_mul(1000)
                    .and_then(|v| v.checked_div(stats.capture_duration_ms))
                    .unwrap_or(0) as u32;
                
                let audio_stats = AudioStats {
                    scope_id: scope_id.clone(),
                    samples_per_second,
                    dropped_samples: stats.errors, // Use errors as proxy for dropped
                    buffer_fill_percent: 0.0, // Not tracked in StreamStats
                    capture_duration_ms: stats.capture_duration_ms,
                    is_capturing: stream_manager.is_any_capturing(),
                };
                
                ws_state.broadcast_to_graphql_stats(&scope_id, audio_stats).await;
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // BOOTSTRAP_KEY check MUST be first - server cannot start without it
    let bootstrap_key = std::env::var("BOOTSTRAP_KEY")
        .expect("BOOTSTRAP_KEY environment variable is required. Exiting.");
    
    if bootstrap_key.len() < 16 {
        eprintln!("BOOTSTRAP_KEY must be at least 16 characters. Exiting.");
        std::process::exit(1);
    }

    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "audio_scope_view=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting Audio Scope View Server...");

    // Load configuration
    let config = AppConfig::load().unwrap_or_default();

    // Initialize database
    let db = DatabaseConnection::new(&config.database.url).await?;

    // Run migrations
    run_migrations(db.pool()).await?;

    // Create repositories
    let scope_repo = Arc::new(SqliteScopeRepository::new(db.pool().clone()));
    let settings_repo = Arc::new(SqliteSettingsRepository::new(db.pool().clone()));
    let waveform_repo = Arc::new(SqliteWaveformRepository::new(db.pool().clone()));

    // Create services
    let scope_service = Arc::new(ScopeService::new(scope_repo.clone()));
    let settings_service = Arc::new(SettingsService::new(
        settings_repo.clone(),
        scope_repo.clone(),
    ));
    let dashboard_service = Arc::new(DashboardService::new(
        scope_repo.clone(),
        waveform_repo.clone(),
    ));
    let waveform_service = Arc::new(WaveformService::new(waveform_repo));
    let simulation_service = Arc::new(SimulationService::new(waveform_service.clone()));
    let batch_capture_service = Arc::new(BatchCaptureService::new(waveform_service.clone()));

    // Create WebSocket state (shared between HTTP and audio tasks)
    let ws_state = Arc::new(api::websocket::handler::WsState::new());

    // Create audio stream manager
    let audio_manager = Arc::new(AudioStreamManager::new());
    info!("Audio backend: {:?}", audio_manager.backend_type());
    // List available audio devices
    match audio_manager.list_devices().await {
        Ok(devices) => {
            for device in &devices {
                let default_marker = if device.is_default { " [DEFAULT]" } else { "" };
                info!("Audio device: {} ({} ch, {} Hz){}", 
                    device.name, device.channels, device.sample_rate, default_marker);
            }
        }
        Err(e) => {
            warn!("Could not enumerate audio devices: {}", e);
        }
    }

    // Create channel for audio events
    let (event_tx, event_rx) = mpsc::channel::<AudioStreamEvent>(100);
    audio_manager.set_event_sender(event_tx);

    // Spawn audio event processor
    let ws_state_clone = ws_state.clone();
    let _processor_handle = tokio::spawn(async move {
        audio_event_processor(event_rx, ws_state_clone).await;
    });

    // Spawn stats reporter
    let audio_manager_clone = audio_manager.clone();
    let ws_state_stats = ws_state.clone();
    let _stats_handle = tokio::spawn(async move {
        stats_reporter(audio_manager_clone, ws_state_stats, 1).await;
    });

    // Create API key store for user-managed keys
    let key_store = Arc::new(ApiKeyStore::new());

    // Create application state
    let state = Arc::new(AppState::new(
        scope_service,
        settings_service,
        dashboard_service,
        waveform_service,
        simulation_service,
        batch_capture_service,
        bootstrap_key,
        key_store,
    ));

    // Start server
    let address = config.server_address();
    info!("GraphQL endpoint: http://{}/graphql", address);
    info!("Health: http://{}/health", address);
    
    if let Err(e) = start_server(&address, state).await {
        error!("Server error: {}", e);
    }

    // Cleanup
    audio_manager.shutdown().await;
    _processor_handle.abort();
    _stats_handle.abort();

    Ok(())
}
