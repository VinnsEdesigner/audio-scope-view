
#![allow(dead_code)]

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, RwLock};
use tokio::time::interval;
use tower_http::cors::CorsLayer;
use tracing::{debug, error, info, warn};

use crate::domain::compression::compress_waveform;
use super::client::{OutgoingMessage, WsClient, WsMessage};

/// Shared WebSocket state with subscription management
pub struct WsState {
    /// All connected clients with their senders
    pub clients: RwLock<HashMap<String, ClientConnection>>,
    /// Configuration
    config: WsConfig,
    /// GraphQL subscription: waveform broadcast channels per scope
    #[doc(hidden)]
    pub waveform_subscribers: RwLock<HashMap<String, tokio::sync::broadcast::Sender<crate::api::schema_subscription::WaveformData>>>,
    /// GraphQL subscription: spectrum broadcast channels per scope
    #[doc(hidden)]
    pub spectrum_subscribers: RwLock<HashMap<String, tokio::sync::broadcast::Sender<crate::api::schema_subscription::SpectrumData>>>,
    /// GraphQL subscription: stats broadcast channels per scope
    #[doc(hidden)]
    pub stats_subscribers: RwLock<HashMap<String, tokio::sync::broadcast::Sender<crate::api::schema_subscription::AudioStats>>>,
    /// GraphQL subscription: analysis results broadcast channels per scope
    #[doc(hidden)]
    pub analysis_subscribers: RwLock<HashMap<String, tokio::sync::broadcast::Sender<crate::api::schema_subscription::AnalysisResult>>>,
    /// GraphQL subscription: all waveform subscribers
    #[doc(hidden)]
    pub all_waveform_subscribers: RwLock<Vec<tokio::sync::broadcast::Sender<crate::api::schema_subscription::WaveformData>>>,
    /// In-memory buffer for live waveform data (for calculations, not persistence)
    /// Key: session_id, Value: circular buffer of recent waveform chunks
    live_waveform_buffers: RwLock<HashMap<String, LiveWaveformBuffer>>,
}

/// In-memory buffer for live waveform capture
/// Keeps only the last N seconds of data for real-time calculations
/// Does NOT persist to database - waveforms are only used for display/calculations
pub(crate) struct LiveWaveformBuffer {
    /// Recent waveform chunks (in memory only)
    chunks: Vec<WaveformChunk>,
    /// Max buffer size (number of chunks to keep)
    max_chunks: usize,
    /// Session ID
    session_id: String,
}

/// A single waveform chunk for live buffer
#[derive(Clone)]
pub(crate) struct WaveformChunk {
    pub samples: Vec<f32>,
    pub timestamp: i64,
    pub sample_rate: u32,
}

/// Client connection with subscription info
#[derive(Debug, Clone)]
pub struct ClientConnection {
    /// Client ID
    pub id: String,
    /// Channel to send messages to client
    pub sender: mpsc::Sender<OutgoingMessage>,
    /// Subscribed waveform scope IDs
    pub subscribed_sessions: Vec<String>,
    /// Subscribed spectrum scope IDs
    pub subscribed_spectrum: Vec<String>,
    /// Whether compression is enabled for this client
    pub compression_enabled: bool,
    /// Connection timestamp
    pub connected_at: chrono::DateTime<chrono::Utc>,
}

impl ClientConnection {
    fn new(id: String, sender: mpsc::Sender<OutgoingMessage>) -> Self {
        Self {
            id,
            sender,
            subscribed_sessions: Vec::new(),
            subscribed_spectrum: Vec::new(),
            compression_enabled: false,
            connected_at: chrono::Utc::now(),
        }
    }

    fn is_subscribed_to_waveform(&self, session_id: &str) -> bool {
        self.subscribed_sessions.iter().any(|s| s == session_id)
    }

    fn is_subscribed_to_spectrum(&self, session_id: &str) -> bool {
        self.subscribed_spectrum.iter().any(|s| s == session_id)
    }
}

/// WebSocket configuration
#[derive(Debug, Clone)]
pub struct WsConfig {
    /// Ping interval in seconds
    pub ping_interval_secs: u64,
    /// Channel buffer size
    pub channel_size: usize,
    /// Maximum message size in bytes
    pub max_message_size: usize,
    /// Enable compression
    pub compression_enabled: bool,
    /// Compression threshold (bytes) - messages larger than this will be compressed
    pub compression_threshold: usize,
}

impl Default for WsConfig {
    fn default() -> Self {
        Self {
            ping_interval_secs: 30,
            channel_size: 256,
            max_message_size: 1024 * 1024, // 1MB
            compression_enabled: true,
            compression_threshold: 1024, // Compress if > 1KB
        }
    }
}

impl WsState {
    /// Create a new WsState with default config
    pub fn new() -> Self {
        Self::with_config(WsConfig::default())
    }

    /// Create with custom configuration
    pub fn with_config(config: WsConfig) -> Self {
        Self {
            clients: RwLock::new(HashMap::new()),
            config,
            waveform_subscribers: RwLock::new(HashMap::new()),
            spectrum_subscribers: RwLock::new(HashMap::new()),
            stats_subscribers: RwLock::new(HashMap::new()),
            analysis_subscribers: RwLock::new(HashMap::new()),
            all_waveform_subscribers: RwLock::new(Vec::new()),
            live_waveform_buffers: RwLock::new(HashMap::new()),
        }
    }

    /// Get number of connected clients
    pub async fn client_count(&self) -> usize {
        self.clients.read().await.len()
    }

    /// Get all client IDs
    pub async fn client_ids(&self) -> Vec<String> {
        self.clients.read().await.keys().cloned().collect()
    }

    /// Get client info
    pub async fn get_client(&self, client_id: &str) -> Option<ClientConnection> {
        self.clients.read().await.get(client_id).cloned()
    }

    /// Broadcast to GraphQL waveform subscribers for a specific scope
    pub async fn broadcast_to_graphql_waveform(&self, session_id: &str, data: crate::api::schema_subscription::WaveformData) {
        // Broadcast to scope-specific subscribers
        let subscribers = self.waveform_subscribers.read().await;
        if let Some(tx) = subscribers.get(session_id) {
            let _ = tx.send(data.clone());
        }
        drop(subscribers);

        // Broadcast to all-waveform subscribers
        let all_subs = self.all_waveform_subscribers.read().await;
        for tx in all_subs.iter() {
            let _ = tx.send(data.clone());
        }
    }

    /// Broadcast to GraphQL spectrum subscribers for a specific scope
    pub async fn broadcast_to_graphql_spectrum(&self, session_id: &str, data: crate::api::schema_subscription::SpectrumData) {
        let subscribers = self.spectrum_subscribers.read().await;
        if let Some(tx) = subscribers.get(session_id) {
            let _ = tx.send(data);
        }
    }

    /// Broadcast to GraphQL stats subscribers for a specific scope
    pub async fn broadcast_to_graphql_stats(&self, session_id: &str, data: crate::api::schema_subscription::AudioStats) {
        let subscribers = self.stats_subscribers.read().await;
        if let Some(tx) = subscribers.get(session_id) {
            let _ = tx.send(data);
        }
    }

    /// Broadcast DSP analysis results to GraphQL subscribers for a specific scope
    pub async fn broadcast_to_graphql_analysis(&self, session_id: &str, data: crate::api::schema_subscription::AnalysisResult) {
        let subscribers = self.analysis_subscribers.read().await;
        if let Some(tx) = subscribers.get(session_id) {
            let _ = tx.send(data);
        }
    }

    /// Add a waveform chunk to the live buffer for a session
    /// This is for in-memory calculations only - NOT persisted
    pub(crate) async fn add_to_live_buffer(&self, session_id: &str, samples: Vec<f32>, timestamp: i64, sample_rate: u32) {
        let mut buffers = self.live_waveform_buffers.write().await;
        
        // Get or create buffer for this session
        let buffer = buffers.entry(session_id.to_string()).or_insert_with(|| {
            LiveWaveformBuffer {
                chunks: Vec::new(),
                max_chunks: 100, // Keep ~100 chunks (~10 seconds at 100ms intervals)
                session_id: session_id.to_string(),
            }
        });
        
        // Add new chunk
        buffer.chunks.push(WaveformChunk {
            samples,
            timestamp,
            sample_rate,
        });
        
        // Evict oldest chunks if buffer is full (circular buffer behavior)
        while buffer.chunks.len() > buffer.max_chunks {
            buffer.chunks.remove(0);
        }
    }

    /// Get the latest waveform from the live buffer for a session
    pub(crate) async fn get_latest_from_buffer(&self, session_id: &str) -> Option<WaveformChunk> {
        let buffers = self.live_waveform_buffers.read().await;
        buffers.get(session_id).and_then(|b| b.chunks.last().cloned())
    }

    /// Get all recent chunks from the live buffer for calculations
    pub(crate) async fn get_recent_from_buffer(&self, session_id: &str, count: usize) -> Vec<WaveformChunk> {
        let buffers = self.live_waveform_buffers.read().await;
        if let Some(buffer) = buffers.get(session_id) {
            let start = buffer.chunks.len().saturating_sub(count);
            buffer.chunks[start..].to_vec()
        } else {
            Vec::new()
        }
    }

    /// Clear the live buffer for a session (called when capture ends)
    pub(crate) async fn clear_live_buffer(&self, session_id: &str) {
        let mut buffers = self.live_waveform_buffers.write().await;
        buffers.remove(session_id);
    }

    /// Check if a session has an active live buffer
    pub(crate) async fn has_live_buffer(&self, session_id: &str) -> bool {
        let buffers = self.live_waveform_buffers.read().await;
        buffers.contains_key(session_id)
    }
}

impl Default for WsState {
    fn default() -> Self {
        Self::new()
    }
}

/// WebSocket route handler
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<WsState>>,
) -> Response {
    let config = state.config.clone();
    ws.on_upgrade(move |socket| handle_socket(socket, state, config))
}

/// Handle WebSocket connection with full production features
async fn handle_socket(socket: WebSocket, state: Arc<WsState>, config: WsConfig) {
    let (sender, mut receiver) = socket.split();
    let client_id = uuid::Uuid::new_v4().to_string();

    info!("New WebSocket connection: {}", client_id);

    // Create channel with configured buffer size
    let (tx, mut rx) = mpsc::channel::<OutgoingMessage>(config.channel_size);

    // Register client
    {
        let mut clients = state.clients.write().await;
        clients.insert(client_id.clone(), ClientConnection::new(client_id.clone(), tx.clone()));
    }

    // Spawn task to handle outgoing messages with keepalive
    let sender_task = tokio::spawn({
        let client_id = client_id.clone();
        async move {
            let mut sender = sender;
            let mut ping_interval = interval(Duration::from_secs(config.ping_interval_secs));
            
            loop {
                tokio::select! {
                    // Handle outgoing messages
                    Some(msg) = rx.recv() => {
                        match msg {
                            OutgoingMessage::Pong => {
                                if sender.send(Message::Pong(vec![].into())).await.is_err() {
                                    debug!("Client {} disconnected", client_id);
                                    break;
                                }
                            }
                            _ => {
                                let json = serde_json::to_string(&msg);
                                match json {
                                    Ok(text) => {
                                        if sender.send(Message::Text(text.into())).await.is_err() {
                                            debug!("Client {} disconnected", client_id);
                                            break;
                                        }
                                    }
                                    Err(e) => {
                                        error!("Failed to serialize message: {}", e);
                                        let _ = sender.send(Message::Close(None)).await;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    // Keepalive ping
                    _ = ping_interval.tick() => {
                        if sender.send(Message::Ping(vec![].into())).await.is_err() {
                            debug!("Client {} ping failed", client_id);
                            break;
                        }
                    }
                }
            }
        }
    });

    // Send welcome message
    let welcome = OutgoingMessage::Connected {
        client_id: client_id.clone(),
    };
    let _ = tx.send(welcome).await;

    // Handle incoming messages
    let _client = WsClient::new();
    
    // Use a flag to track if we should continue
    let mut running = true;
    let sender_task = Some(sender_task);
    while running {
        tokio::select! {
            msg = receiver.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        let text_str = text.to_string();
                        if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text_str) {
                            handle_client_message(&state, &client_id, ws_msg, &tx).await;
                        }
                    }
                    Some(Ok(Message::Binary(data))) => {
                        // Handle binary data (e.g., for compressed data upload)
                        debug!("Received binary data from {}: {} bytes", client_id, data.len());
                    }
                    Some(Ok(Message::Ping(data))) => {
                        debug!("Received ping from {}", client_id);
                        let _ = tx.send(OutgoingMessage::Pong).await;
                        let _ = data;
                    }
                    Some(Ok(Message::Pong(_))) => {
                        // Ping acknowledged
                    }
                    Some(Ok(Message::Close(reason))) => {
                        info!("Client {} closed: {:?}", client_id, reason);
                        running = false;
                    }
                    Some(Err(e)) => {
                        warn!("WebSocket error for {}: {}", client_id, e);
                        running = false;
                    }
                    None => {
                        info!("Client {} disconnected", client_id);
                        running = false;
                    }
                }
            }
            // Check if sender task died
            _ = async { 
                if let Some(ref task) = sender_task {
                    if task.is_finished() {
                        return;
                    }
                    // Poll the task to detect completion
                    let _ = task; 
                }
                futures_util::future::pending().await
            } => {
                warn!("Sender task for {} died", client_id);
                running = false;
            }
        }
    }

    // Cleanup
    if let Some(task) = sender_task
        && !task.is_finished() {
            task.abort();
        }
    {
        let mut clients = state.clients.write().await;
        clients.remove(&client_id);
    }
    info!("Client {} disconnected and cleaned up", client_id);
}

/// Handle incoming message from client with proper subscription management
async fn handle_client_message(
    state: &Arc<WsState>,
    client_id: &str,
    msg: WsMessage,
    sender: &mpsc::Sender<OutgoingMessage>,
) {
    match msg {
        WsMessage::Subscribe { session_id } => {
            let session_id_clone = session_id.clone();
            // Update client subscription
            {
                let mut clients = state.clients.write().await;
                if let Some(client) = clients.get_mut(client_id)
                    && !client.subscribed_sessions.contains(&session_id) {
                        client.subscribed_sessions.push(session_id);
                    }
            }
            
            let response = OutgoingMessage::Subscribed {
                session_id: session_id_clone.clone(),
                stream_type: "waveform".to_string(),
            };
            let _ = sender.send(response).await;
            debug!("Client {} subscribed to waveform: {}", client_id, session_id_clone);
        }
        
        WsMessage::Unsubscribe { session_id } => {
            let session_id_clone = session_id.clone();
            // Update client subscription
            {
                let mut clients = state.clients.write().await;
                if let Some(client) = clients.get_mut(client_id) {
                    client.subscribed_sessions.retain(|s| s != &session_id);
                }
            }
            
            let response = OutgoingMessage::Unsubscribed {
                session_id: session_id_clone.clone(),
                stream_type: "waveform".to_string(),
            };
            let _ = sender.send(response).await;
            debug!("Client {} unsubscribed from waveform: {}", client_id, session_id_clone);
        }
        
        WsMessage::SubscribeSpectrum { session_id } => {
            let session_id_clone = session_id.clone();
            // Update client subscription
            {
                let mut clients = state.clients.write().await;
                if let Some(client) = clients.get_mut(client_id)
                    && !client.subscribed_spectrum.contains(&session_id) {
                        client.subscribed_spectrum.push(session_id);
                    }
            }
            
            let response = OutgoingMessage::Subscribed {
                session_id: session_id_clone.clone(),
                stream_type: "spectrum".to_string(),
            };
            let _ = sender.send(response).await;
            debug!("Client {} subscribed to spectrum: {}", client_id, session_id_clone);
        }
        
        WsMessage::UnsubscribeSpectrum { session_id } => {
            let session_id_clone = session_id.clone();
            // Update client subscription
            {
                let mut clients = state.clients.write().await;
                if let Some(client) = clients.get_mut(client_id) {
                    client.subscribed_spectrum.retain(|s| s != &session_id);
                }
            }
            
            let response = OutgoingMessage::Unsubscribed {
                session_id: session_id_clone.clone(),
                stream_type: "spectrum".to_string(),
            };
            let _ = sender.send(response).await;
            debug!("Client {} unsubscribed from spectrum: {}", client_id, session_id_clone);
        }
        
        WsMessage::WaveformData {
            session_id,
            samples,
            timestamp,
            sample_rate,
            peak_amplitude: _,  // Ignored - server calculates own values
            rms_amplitude: _,  // Ignored - server calculates own values
        } => {
            let sample_rate_f = sample_rate as f32;
            
            // Perform waveform analysis (basic measurements)
            let waveform_analysis = crate::domain::measurements::analyze_waveform(&samples, sample_rate_f);
            
            // Perform harmonic analysis (detailed frequency breakdown)
            let harmonic_analysis = crate::domain::measurements::analyze_harmonics(&samples, sample_rate_f);
            
            // Build harmonics list (first 10)
            let harmonics: Vec<crate::api::schema_subscription::HarmonicComponent> = harmonic_analysis
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
            
            // Broadcast DSP analysis results to GraphQL subscribers (for UI updates)
            let analysis_data = crate::api::schema_subscription::AnalysisResult {
                session_id: session_id.clone(),
                timestamp,
                sample_rate,
                // Basic amplitude metrics
                peak_amplitude: waveform_analysis.peak_amplitude,
                rms_amplitude: waveform_analysis.rms_amplitude,
                dc_offset: waveform_analysis.dc_offset,
                // Frequency metrics
                dominant_frequency: waveform_analysis.dominant_frequency,
                fundamental_frequency: harmonic_analysis.fundamental.frequency,
                // Signal quality metrics
                thd: waveform_analysis.thd,
                thdn: harmonic_analysis.thdn,
                snr: waveform_analysis.snr,
                crest_factor: waveform_analysis.crest_factor,
                // Energy metrics
                signal_energy: harmonic_analysis.signal_energy,
                noise_energy: harmonic_analysis.noise_energy,
                // Harmonic breakdown
                harmonics,
            };
            state.broadcast_to_graphql_analysis(&session_id, analysis_data).await;
            
            // Store in live buffer for calculations (NOT persisted to database)
            // Buffer keeps last ~10 seconds of data in memory, auto-evicts old chunks
            state.add_to_live_buffer(&session_id, samples.clone(), timestamp, sample_rate).await;
            
            debug!(
                "Received waveform data from client {} for session {}: {} samples, freq={:.1}Hz, thd={:.2}%, thdn={:.2}%",
                client_id,
                session_id,
                samples.len(),
                waveform_analysis.dominant_frequency,
                waveform_analysis.thd * 100.0,
                harmonic_analysis.thdn * 100.0
            );
        }
        
        WsMessage::AnalysisData {
            session_id,
            peak_amplitude,
            rms_amplitude,
            dominant_frequency,
            frequency_high: _,
            frequency_low: _,
            dc_offset: _,
            timestamp: _,
        } => {
            // Broadcast analysis data to GraphQL subscribers
            // Note: Could also store this in session DSP metrics via GraphQL mutation
            let analysis = OutgoingMessage::Analysis {
                session_id: session_id.clone(),
                peak_amplitude,
                rms_amplitude,
                dominant_frequency,
                thd: 0.0, // THD not sent from client
                snr: 0.0, // SNR not sent from client
                timestamp: chrono::Utc::now().timestamp_millis(),
            };
            
            // Send analysis to the client that sent it (for confirmation)
            let clients = state.clients.read().await;
            if let Some(client) = clients.get(client_id) {
                let _ = client.sender.send(analysis).await;
            }
            
            debug!(
                "Received analysis data from client {} for session {}: peak={}, rms={}, freq={}",
                client_id,
                session_id,
                peak_amplitude,
                rms_amplitude,
                dominant_frequency
            );
        }
        
        WsMessage::Ping => {
            let response = OutgoingMessage::Pong;
            let _ = sender.send(response).await;
        }
        
        WsMessage::Pong => {}
        
        WsMessage::EnableCompression { enabled, threshold } => {
            // Update client compression preference
            {
                let mut clients = state.clients.write().await;
                if let Some(client) = clients.get_mut(client_id) {
                    client.compression_enabled = enabled;
                }
            }
            
            // Update global threshold if provided (currently unused - config is private)
            let _ = threshold;
            
            let response = OutgoingMessage::CompressionStatus { enabled };
            let _ = sender.send(response).await;
            debug!("Client {} compression enabled: {}", client_id, enabled);
        }
        
        WsMessage::Error { message } => {
            warn!("Client {} error: {}", client_id, message);
            let response = OutgoingMessage::Error {
                message: format!("Server received error: {}", message),
            };
            let _ = sender.send(response).await;
        }
    }
}

/// Create the WebSocket router
pub fn create_ws_router(state: Arc<WsState>) -> Router {
    Router::new()
        .route("/", get(ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

/// Broadcast waveform to only subscribed clients (production-ready filtering)
pub async fn broadcast_waveform(
    state: &Arc<WsState>,
    session_id: &str,
    samples: Vec<f32>,
    timestamp: i64,
    sample_rate: u32,
) {
    let config = &state.config;
    let session_id_owned = session_id.to_string();
    
    // Compress if enabled and sample count exceeds threshold
    let use_compression = config.compression_enabled && samples.len() * 4 > config.compression_threshold;
    let compressed_data = if use_compression {
        compress_waveform(&samples).ok()
    } else {
        None
    };

    let clients = state.clients.read().await;
    for (client_id, client) in clients.iter() {
        // Only send to clients subscribed to this scope
        if client.is_subscribed_to_waveform(session_id) {
            debug!("Broadcasting waveform to subscribed client {}", client_id);
            
            let msg = match (&compressed_data, client.compression_enabled) {
                (Some(comp), true) => {
                    // Send compressed
                    OutgoingMessage::CompressedWaveform {
                        session_id: session_id_owned.clone(),
                        data: comp.data.clone(),
                        sample_count: comp.sample_count,
                        original_size: comp.original_size,
                        timestamp,
                        sample_rate,
                    }
                }
                _ => {
                    // Send uncompressed
                    OutgoingMessage::Waveform {
                        session_id: session_id_owned.clone(),
                        samples: samples.clone(),
                        timestamp,
                        sample_rate,
                    }
                }
            };
            let _ = client.sender.send(msg).await;
        }
    }
}

/// Broadcast spectrum to only subscribed clients (production-ready filtering)
pub async fn broadcast_spectrum(
    state: &Arc<WsState>,
    session_id: &str,
    frequencies: Vec<f32>,
    magnitudes: Vec<f32>,
    timestamp: i64,
) {
    let msg = OutgoingMessage::Spectrum {
        session_id: session_id.to_string(),
        frequencies,
        magnitudes,
        timestamp,
    };

    let clients = state.clients.read().await;
    for (client_id, client) in clients.iter() {
        // Only send to clients subscribed to this scope
        if client.is_subscribed_to_spectrum(session_id) {
            debug!("Broadcasting spectrum to subscribed client {}", client_id);
            let _ = client.sender.send(msg.clone()).await;
        }
    }
}

/// Broadcast to all clients (for system messages)
pub async fn broadcast_all(state: &Arc<WsState>, msg: OutgoingMessage) {
    let clients = state.clients.read().await;
    for client in clients.values() {
        let _ = client.sender.send(msg.clone()).await;
    }
}

/// Broadcast analysis results
#[allow(clippy::too_many_arguments)]
pub async fn broadcast_analysis(
    state: &Arc<WsState>,
    session_id: &str,
    peak_amplitude: f32,
    rms_amplitude: f32,
    dominant_frequency: f32,
    thd: f32,
    snr: f32,
    timestamp: i64,
) {
    let msg = OutgoingMessage::Analysis {
        session_id: session_id.to_string(),
        peak_amplitude,
        rms_amplitude,
        dominant_frequency,
        thd,
        snr,
        timestamp,
    };

    let clients = state.clients.read().await;
    for client in clients.values() {
        if client.is_subscribed_to_waveform(session_id) {
            let _ = client.sender.send(msg.clone()).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ws_state_creation() {
        let state = WsState::new();
        let clients = state.clients.read().await;
        assert!(clients.is_empty());
    }

    #[tokio::test]
    async fn test_client_subscription() {
        let state = WsState::new();
        let client_id = "test-client".to_string();
        
        // Add a mock client
        let (tx, _rx) = mpsc::channel(10);
        {
            let mut clients = state.clients.write().await;
            clients.insert(client_id.clone(), ClientConnection::new(client_id.clone(), tx));
        }
        
        // Verify subscription check
        {
            let clients = state.clients.read().await;
            let client = clients.get(&client_id).unwrap();
            assert!(!client.is_subscribed_to_waveform("scope1"));
        }
    }
}
