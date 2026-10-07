#![allow(dead_code)]

use axum::{
    extract::{
        Query, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::{IntoResponse, Response},
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{RwLock, mpsc};
use tokio::time::interval;
use tracing::{debug, error, info, warn};

use super::client::{OutgoingMessage, WsClient, WsMessage};
use crate::api::server_graphql::{AppState, AuthHeaderExt, DeviceIdExt, RequestIdentity};
use crate::domain::compress_waveform;
use crate::shared::constants::is_valid_device_id;

pub struct WsState {
    pub clients: RwLock<HashMap<String, ClientConnection>>,
    config: WsConfig,
    #[doc(hidden)]
    pub waveform_subscribers: RwLock<
        HashMap<
            String,
            tokio::sync::broadcast::Sender<crate::api::schema_subscription::WaveformData>,
        >,
    >,
    #[doc(hidden)]
    pub spectrum_subscribers: RwLock<
        HashMap<
            String,
            tokio::sync::broadcast::Sender<crate::api::schema_subscription::SpectrumData>,
        >,
    >,
    #[doc(hidden)]
    pub stats_subscribers: RwLock<
        HashMap<
            String,
            tokio::sync::broadcast::Sender<crate::api::schema_subscription::AudioStats>,
        >,
    >,
    #[doc(hidden)]
    pub analysis_subscribers: RwLock<
        HashMap<
            String,
            tokio::sync::broadcast::Sender<crate::api::schema_subscription::AnalysisResult>,
        >,
    >,
    #[doc(hidden)]
    pub all_waveform_subscribers:
        RwLock<Vec<tokio::sync::broadcast::Sender<crate::api::schema_subscription::WaveformData>>>,
    live_waveform_buffers: RwLock<HashMap<String, LiveWaveformBuffer>>,
}

pub(crate) struct LiveWaveformBuffer {
    chunks: Vec<WaveformChunk>,
    max_chunks: usize,
    session_id: String,
}

#[derive(Clone)]
pub(crate) struct WaveformChunk {
    pub samples: Vec<f32>,
    pub timestamp: i64,
    pub sample_rate: u32,
}

#[derive(Debug, Clone)]
pub struct ClientConnection {
    pub id: String,
    pub sender: mpsc::Sender<OutgoingMessage>,
    pub subscribed_sessions: Vec<String>,
    pub subscribed_spectrum: Vec<String>,
    pub compression_enabled: bool,
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

#[derive(Debug, Clone)]
pub struct WsConfig {
    pub ping_interval_secs: u64,
    pub channel_size: usize,
    pub max_message_size: usize,
    pub compression_enabled: bool,
    pub compression_threshold: usize,
}

impl Default for WsConfig {
    fn default() -> Self {
        Self {
            ping_interval_secs: 30,
            channel_size: 256,
            max_message_size: 1024 * 1024,
            compression_enabled: true,
            compression_threshold: 1024,
        }
    }
}

impl WsState {
    pub fn new() -> Self {
        Self::with_config(WsConfig::default())
    }

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

    pub async fn client_count(&self) -> usize {
        self.clients.read().await.len()
    }

    pub async fn client_ids(&self) -> Vec<String> {
        self.clients.read().await.keys().cloned().collect()
    }

    pub async fn get_client(&self, client_id: &str) -> Option<ClientConnection> {
        self.clients.read().await.get(client_id).cloned()
    }

    pub async fn broadcast_to_graphql_waveform(
        &self,
        session_id: &str,
        data: crate::api::schema_subscription::WaveformData,
    ) {
        let subscribers = self.waveform_subscribers.read().await;
        if let Some(tx) = subscribers.get(session_id) {
            let _ = tx.send(data.clone());
        }
        drop(subscribers);

        let all_subs = self.all_waveform_subscribers.read().await;
        for tx in all_subs.iter() {
            let _ = tx.send(data.clone());
        }
    }

    pub async fn broadcast_to_graphql_spectrum(
        &self,
        session_id: &str,
        data: crate::api::schema_subscription::SpectrumData,
    ) {
        let subscribers = self.spectrum_subscribers.read().await;
        if let Some(tx) = subscribers.get(session_id) {
            let _ = tx.send(data);
        }
    }

    pub async fn broadcast_to_graphql_stats(
        &self,
        session_id: &str,
        data: crate::api::schema_subscription::AudioStats,
    ) {
        let subscribers = self.stats_subscribers.read().await;
        if let Some(tx) = subscribers.get(session_id) {
            let _ = tx.send(data);
        }
    }

    pub async fn broadcast_to_graphql_analysis(
        &self,
        session_id: &str,
        data: crate::api::schema_subscription::AnalysisResult,
    ) {
        let subscribers = self.analysis_subscribers.read().await;
        if let Some(tx) = subscribers.get(session_id) {
            let _ = tx.send(data);
        }
    }

    pub(crate) async fn add_to_live_buffer(
        &self,
        session_id: &str,
        samples: Vec<f32>,
        timestamp: i64,
        sample_rate: u32,
    ) {
        let mut buffers = self.live_waveform_buffers.write().await;

        let buffer = buffers
            .entry(session_id.to_string())
            .or_insert_with(|| LiveWaveformBuffer {
                chunks: Vec::new(),
                max_chunks: 100,
                session_id: session_id.to_string(),
            });

        buffer.chunks.push(WaveformChunk {
            samples,
            timestamp,
            sample_rate,
        });

        while buffer.chunks.len() > buffer.max_chunks {
            buffer.chunks.remove(0);
        }
    }

    pub(crate) async fn get_latest_from_buffer(&self, session_id: &str) -> Option<WaveformChunk> {
        let buffers = self.live_waveform_buffers.read().await;
        buffers
            .get(session_id)
            .and_then(|b| b.chunks.last().cloned())
    }

    pub(crate) async fn get_recent_from_buffer(
        &self,
        session_id: &str,
        count: usize,
    ) -> Vec<WaveformChunk> {
        let buffers = self.live_waveform_buffers.read().await;
        if let Some(buffer) = buffers.get(session_id) {
            let start = buffer.chunks.len().saturating_sub(count);
            buffer.chunks[start..].to_vec()
        } else {
            Vec::new()
        }
    }

    pub(crate) async fn clear_live_buffer(&self, session_id: &str) {
        let mut buffers = self.live_waveform_buffers.write().await;
        buffers.remove(session_id);
    }

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

/// Query params accepted by the WebSocket handshake. The browser cannot set
/// custom headers on a `WebSocket` handshake, so the device id and bootstrap
/// key are passed here instead.
#[derive(Debug, Deserialize)]
pub struct WsHandshakeQuery {
    /// Optional `X-Device-Id` value (also accepted via the `x-device-id` header
    /// injected by the auth middleware).
    #[serde(rename = "X-Device-Id")]
    device_id: Option<String>,
    /// Optional bootstrap key / API key (also accepted via the `Authorization`
    /// header injected by the auth middleware).
    #[serde(rename = "X-Api-Key")]
    api_key: Option<String>,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsHandshakeQuery>,
    State(state): State<Arc<AppState>>,
    axum::extract::Extension(AuthHeaderExt(header_auth)): axum::extract::Extension<AuthHeaderExt>,
    axum::extract::Extension(DeviceIdExt(header_device_id)): axum::extract::Extension<DeviceIdExt>,
) -> Response {
    // The auth middleware extracted Authorization + X-Device-Id from headers.
    // The browser WebSocket API can't set those headers, so fall back to the
    // query string values the client attached to the URL.
    let auth_header = header_auth.or_else(|| query.api_key.clone());
    let device_id = header_device_id.or_else(|| query.device_id.clone());

    // Validate the device id shape. A malformed id must never become a scoping
    // key, so reject the handshake early (an absent id is allowed for admins).
    if let Some(ref did) = device_id
        && !is_valid_device_id(did)
    {
        info!("WS: rejected malformed device id");
        return (
            axum::http::StatusCode::BAD_REQUEST,
            "Invalid X-Device-Id: must be a well-formed device identifier",
        )
            .into_response();
    }

    let (api_key_info, is_system_client) = state.validate_api_key(auth_header.as_deref()).await;
    if api_key_info.is_none() && !is_system_client {
        info!("WS: AUTH FAILED - invalid or missing API key");
        return (
            axum::http::StatusCode::UNAUTHORIZED,
            "Unauthorized: invalid or missing API key",
        )
            .into_response();
    }

    let identity = RequestIdentity {
        device_id,
        is_system_client,
        api_key: api_key_info,
    };
    let scope = identity.effective_device_id().map(|s| s.to_string());
    info!(
        "WS: AUTH OK (device: {})",
        scope.as_deref().unwrap_or("<unscoped>")
    );

    let ws_state = state.ws_state.clone();
    let session_service = state.context.session_service.clone();
    let config = ws_state.config.clone();
    ws.on_upgrade(move |socket| handle_socket(socket, ws_state, session_service, identity, config))
}

async fn handle_socket(
    socket: WebSocket,
    state: Arc<WsState>,
    session_service: Arc<crate::application::SessionService>,
    identity: RequestIdentity,
    config: WsConfig,
) {
    let (sender, mut receiver) = socket.split();
    let client_id = uuid::Uuid::new_v4().to_string();

    info!("New WebSocket connection: {}", client_id);

    let (tx, mut rx) = mpsc::channel::<OutgoingMessage>(config.channel_size);

    {
        let mut clients = state.clients.write().await;
        clients.insert(
            client_id.clone(),
            ClientConnection::new(client_id.clone(), tx.clone()),
        );
    }

    let sender_task = tokio::spawn({
        let client_id = client_id.clone();
        async move {
            let mut sender = sender;
            let mut ping_interval = interval(Duration::from_secs(config.ping_interval_secs));

            loop {
                tokio::select! {
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

    let welcome = OutgoingMessage::Connected {
        client_id: client_id.clone(),
    };
    let _ = tx.send(welcome).await;

    let _client = WsClient::new();

    let mut running = true;
    let sender_task = Some(sender_task);
    while running {
        tokio::select! {
            msg = receiver.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        let text_str = text.to_string();
                        if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text_str) {
                            handle_client_message(&state, &session_service, &identity, &client_id, ws_msg, &tx).await;
                        }
                    }
                    Some(Ok(Message::Binary(data))) => {
                        debug!("Received binary data from {}: {} bytes", client_id, data.len());
                    }
                    Some(Ok(Message::Ping(data))) => {
                        debug!("Received ping from {}", client_id);
                        let _ = tx.send(OutgoingMessage::Pong).await;
                        let _ = data;
                    }
                    Some(Ok(Message::Pong(_))) => {
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
            _ = async {
                if let Some(ref task) = sender_task {
                    if task.is_finished() {
                        return;
                    }
                    let _ = task;
                }
                futures_util::future::pending().await
            } => {
                warn!("Sender task for {} died", client_id);
                running = false;
            }
        }
    }

    if let Some(task) = sender_task
        && !task.is_finished()
    {
        task.abort();
    }
    {
        let mut clients = state.clients.write().await;
        clients.remove(&client_id);
    }
    info!("Client {} disconnected and cleaned up", client_id);
}

/// Verifies that the session referenced by a WS subscribe/publish message
/// belongs to the connecting device. Unscoped admin/system connections are
/// allowed to subscribe to any session.
async fn verify_ws_session_ownership(
    session_service: &Arc<crate::application::SessionService>,
    identity: &RequestIdentity,
    session_id: &str,
) -> bool {
    if identity.is_unscoped_admin() {
        return true;
    }
    let expected_device = match identity.effective_device_id() {
        Some(d) => d,
        None => return false,
    };
    match session_service.get(session_id).await {
        Ok(Some(session)) => session.user_id == expected_device,
        _ => false,
    }
}

async fn handle_client_message(
    state: &Arc<WsState>,
    session_service: &Arc<crate::application::SessionService>,
    identity: &RequestIdentity,
    client_id: &str,
    msg: WsMessage,
    sender: &mpsc::Sender<OutgoingMessage>,
) {
    match msg {
        WsMessage::Subscribe { session_id } => {
            if !verify_ws_session_ownership(session_service, identity, &session_id).await {
                info!(
                    "WS: denied Subscribe to session {} for client {} (device mismatch)",
                    session_id, client_id
                );
                let _ = sender
                    .send(OutgoingMessage::Error {
                        message: "Forbidden: session does not belong to this device".to_string(),
                    })
                    .await;
                return;
            }
            let session_id_clone = session_id.clone();
            {
                let mut clients = state.clients.write().await;
                if let Some(client) = clients.get_mut(client_id)
                    && !client.subscribed_sessions.contains(&session_id)
                {
                    client.subscribed_sessions.push(session_id);
                }
            }

            let response = OutgoingMessage::Subscribed {
                session_id: session_id_clone.clone(),
                stream_type: "waveform".to_string(),
            };
            let _ = sender.send(response).await;
            debug!(
                "Client {} subscribed to waveform: {}",
                client_id, session_id_clone
            );
        }

        WsMessage::Unsubscribe { session_id } => {
            let session_id_clone = session_id.clone();
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
            debug!(
                "Client {} unsubscribed from waveform: {}",
                client_id, session_id_clone
            );
        }

        WsMessage::SubscribeSpectrum { session_id } => {
            if !verify_ws_session_ownership(session_service, identity, &session_id).await {
                info!(
                    "WS: denied SubscribeSpectrum to session {} for client {} (device mismatch)",
                    session_id, client_id
                );
                let _ = sender
                    .send(OutgoingMessage::Error {
                        message: "Forbidden: session does not belong to this device".to_string(),
                    })
                    .await;
                return;
            }
            let session_id_clone = session_id.clone();
            {
                let mut clients = state.clients.write().await;
                if let Some(client) = clients.get_mut(client_id)
                    && !client.subscribed_spectrum.contains(&session_id)
                {
                    client.subscribed_spectrum.push(session_id);
                }
            }

            let response = OutgoingMessage::Subscribed {
                session_id: session_id_clone.clone(),
                stream_type: "spectrum".to_string(),
            };
            let _ = sender.send(response).await;
            debug!(
                "Client {} subscribed to spectrum: {}",
                client_id, session_id_clone
            );
        }

        WsMessage::UnsubscribeSpectrum { session_id } => {
            let session_id_clone = session_id.clone();
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
            debug!(
                "Client {} unsubscribed from spectrum: {}",
                client_id, session_id_clone
            );
        }

        WsMessage::WaveformData {
            session_id,
            samples,
            timestamp,
            sample_rate,
            peak_amplitude: _,
            rms_amplitude: _,
        } => {
            // Only accept published waveform data for sessions this device owns,
            // otherwise a client could inject data into another device's session.
            if !verify_ws_session_ownership(session_service, identity, &session_id).await {
                info!(
                    "WS: denied WaveformData publish to session {} for client {} (device mismatch)",
                    session_id, client_id
                );
                return;
            }
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
                timestamp,
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
            state
                .broadcast_to_graphql_analysis(&session_id, analysis_data)
                .await;

            state
                .add_to_live_buffer(&session_id, samples.clone(), timestamp, sample_rate)
                .await;

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
            if !verify_ws_session_ownership(session_service, identity, &session_id).await {
                info!(
                    "WS: denied AnalysisData publish to session {} for client {} (device mismatch)",
                    session_id, client_id
                );
                return;
            }
            let analysis = OutgoingMessage::Analysis {
                session_id: session_id.clone(),
                peak_amplitude,
                rms_amplitude,
                dominant_frequency,
                thd: 0.0,
                snr: 0.0,
                timestamp: chrono::Utc::now().timestamp_millis(),
            };

            let clients = state.clients.read().await;
            if let Some(client) = clients.get(client_id) {
                let _ = client.sender.send(analysis).await;
            }

            debug!(
                "Received analysis data from client {} for session {}: peak={}, rms={}, freq={}",
                client_id, session_id, peak_amplitude, rms_amplitude, dominant_frequency
            );
        }

        WsMessage::Ping => {
            let response = OutgoingMessage::Pong;
            let _ = sender.send(response).await;
        }

        WsMessage::Pong => {}

        WsMessage::EnableCompression { enabled, threshold } => {
            {
                let mut clients = state.clients.write().await;
                if let Some(client) = clients.get_mut(client_id) {
                    client.compression_enabled = enabled;
                }
            }

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

pub async fn broadcast_waveform(
    state: &Arc<WsState>,
    session_id: &str,
    samples: Vec<f32>,
    timestamp: i64,
    sample_rate: u32,
) {
    let config = &state.config;
    let session_id_owned = session_id.to_string();

    let use_compression =
        config.compression_enabled && samples.len() * 4 > config.compression_threshold;
    let compressed_data = if use_compression {
        compress_waveform(&samples)
    } else {
        None
    };

    let clients = state.clients.read().await;
    for (client_id, client) in clients.iter() {
        if client.is_subscribed_to_waveform(session_id) {
            debug!("Broadcasting waveform to subscribed client {}", client_id);

            let msg = match (&compressed_data, client.compression_enabled) {
                (Some(comp), true) => OutgoingMessage::CompressedWaveform {
                    session_id: session_id_owned.clone(),
                    data: comp.data.clone(),
                    sample_count: comp.sample_count,
                    original_size: comp.original_size,
                    timestamp,
                    sample_rate,
                },
                _ => OutgoingMessage::Waveform {
                    session_id: session_id_owned.clone(),
                    samples: samples.clone(),
                    timestamp,
                    sample_rate,
                },
            };
            let _ = client.sender.send(msg).await;
        }
    }
}

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
        if client.is_subscribed_to_spectrum(session_id) {
            debug!("Broadcasting spectrum to subscribed client {}", client_id);
            let _ = client.sender.send(msg.clone()).await;
        }
    }
}

pub async fn broadcast_all(state: &Arc<WsState>, msg: OutgoingMessage) {
    let clients = state.clients.read().await;
    for client in clients.values() {
        let _ = client.sender.send(msg.clone()).await;
    }
}

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

        let (tx, _rx) = mpsc::channel(10);
        {
            let mut clients = state.clients.write().await;
            clients.insert(
                client_id.clone(),
                ClientConnection::new(client_id.clone(), tx),
            );
        }

        {
            let clients = state.clients.read().await;
            let client = clients.get(&client_id).unwrap();
            assert!(!client.is_subscribed_to_waveform("scope1"));
        }
    }
}
