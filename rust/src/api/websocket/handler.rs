
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
    /// GraphQL subscription: all waveform subscribers
    #[doc(hidden)]
    pub all_waveform_subscribers: RwLock<Vec<tokio::sync::broadcast::Sender<crate::api::schema_subscription::WaveformData>>>,
}

/// Client connection with subscription info
#[derive(Debug, Clone)]
pub struct ClientConnection {
    /// Client ID
    pub id: String,
    /// Channel to send messages to client
    pub sender: mpsc::Sender<OutgoingMessage>,
    /// Subscribed waveform scope IDs
    pub subscribed_scopes: Vec<String>,
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
            subscribed_scopes: Vec::new(),
            subscribed_spectrum: Vec::new(),
            compression_enabled: false,
            connected_at: chrono::Utc::now(),
        }
    }

    fn is_subscribed_to_waveform(&self, scope_id: &str) -> bool {
        self.subscribed_scopes.iter().any(|s| s == scope_id)
    }

    fn is_subscribed_to_spectrum(&self, scope_id: &str) -> bool {
        self.subscribed_spectrum.iter().any(|s| s == scope_id)
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
            all_waveform_subscribers: RwLock::new(Vec::new()),
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
    pub async fn broadcast_to_graphql_waveform(&self, scope_id: &str, data: crate::api::schema_subscription::WaveformData) {
        // Broadcast to scope-specific subscribers
        let subscribers = self.waveform_subscribers.read().await;
        if let Some(tx) = subscribers.get(scope_id) {
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
    pub async fn broadcast_to_graphql_spectrum(&self, scope_id: &str, data: crate::api::schema_subscription::SpectrumData) {
        let subscribers = self.spectrum_subscribers.read().await;
        if let Some(tx) = subscribers.get(scope_id) {
            let _ = tx.send(data);
        }
    }

    /// Broadcast to GraphQL stats subscribers for a specific scope
    pub async fn broadcast_to_graphql_stats(&self, scope_id: &str, data: crate::api::schema_subscription::AudioStats) {
        let subscribers = self.stats_subscribers.read().await;
        if let Some(tx) = subscribers.get(scope_id) {
            let _ = tx.send(data);
        }
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
        WsMessage::Subscribe { scope_id } => {
            let scope_id_clone = scope_id.clone();
            // Update client subscription
            {
                let mut clients = state.clients.write().await;
                if let Some(client) = clients.get_mut(client_id)
                    && !client.subscribed_scopes.contains(&scope_id) {
                        client.subscribed_scopes.push(scope_id);
                    }
            }
            
            let response = OutgoingMessage::Subscribed {
                scope_id: scope_id_clone.clone(),
                stream_type: "waveform".to_string(),
            };
            let _ = sender.send(response).await;
            debug!("Client {} subscribed to waveform: {}", client_id, scope_id_clone);
        }
        
        WsMessage::Unsubscribe { scope_id } => {
            let scope_id_clone = scope_id.clone();
            // Update client subscription
            {
                let mut clients = state.clients.write().await;
                if let Some(client) = clients.get_mut(client_id) {
                    client.subscribed_scopes.retain(|s| s != &scope_id);
                }
            }
            
            let response = OutgoingMessage::Unsubscribed {
                scope_id: scope_id_clone.clone(),
                stream_type: "waveform".to_string(),
            };
            let _ = sender.send(response).await;
            debug!("Client {} unsubscribed from waveform: {}", client_id, scope_id_clone);
        }
        
        WsMessage::SubscribeSpectrum { scope_id } => {
            let scope_id_clone = scope_id.clone();
            // Update client subscription
            {
                let mut clients = state.clients.write().await;
                if let Some(client) = clients.get_mut(client_id)
                    && !client.subscribed_spectrum.contains(&scope_id) {
                        client.subscribed_spectrum.push(scope_id);
                    }
            }
            
            let response = OutgoingMessage::Subscribed {
                scope_id: scope_id_clone.clone(),
                stream_type: "spectrum".to_string(),
            };
            let _ = sender.send(response).await;
            debug!("Client {} subscribed to spectrum: {}", client_id, scope_id_clone);
        }
        
        WsMessage::UnsubscribeSpectrum { scope_id } => {
            let scope_id_clone = scope_id.clone();
            // Update client subscription
            {
                let mut clients = state.clients.write().await;
                if let Some(client) = clients.get_mut(client_id) {
                    client.subscribed_spectrum.retain(|s| s != &scope_id);
                }
            }
            
            let response = OutgoingMessage::Unsubscribed {
                scope_id: scope_id_clone.clone(),
                stream_type: "spectrum".to_string(),
            };
            let _ = sender.send(response).await;
            debug!("Client {} unsubscribed from spectrum: {}", client_id, scope_id_clone);
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
    scope_id: &str,
    samples: Vec<f32>,
    timestamp: i64,
    sample_rate: u32,
) {
    let config = &state.config;
    let scope_id_owned = scope_id.to_string();
    
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
        if client.is_subscribed_to_waveform(scope_id) {
            debug!("Broadcasting waveform to subscribed client {}", client_id);
            
            let msg = match (&compressed_data, client.compression_enabled) {
                (Some(comp), true) => {
                    // Send compressed
                    OutgoingMessage::CompressedWaveform {
                        scope_id: scope_id_owned.clone(),
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
                        scope_id: scope_id_owned.clone(),
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
    scope_id: &str,
    frequencies: Vec<f32>,
    magnitudes: Vec<f32>,
    timestamp: i64,
) {
    let msg = OutgoingMessage::Spectrum {
        scope_id: scope_id.to_string(),
        frequencies,
        magnitudes,
        timestamp,
    };

    let clients = state.clients.read().await;
    for (client_id, client) in clients.iter() {
        // Only send to clients subscribed to this scope
        if client.is_subscribed_to_spectrum(scope_id) {
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
    scope_id: &str,
    peak_amplitude: f32,
    rms_amplitude: f32,
    dominant_frequency: f32,
    thd: f32,
    snr: f32,
    timestamp: i64,
) {
    let msg = OutgoingMessage::Analysis {
        scope_id: scope_id.to_string(),
        peak_amplitude,
        rms_amplitude,
        dominant_frequency,
        thd,
        snr,
        timestamp,
    };

    let clients = state.clients.read().await;
    for client in clients.values() {
        if client.is_subscribed_to_waveform(scope_id) {
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
