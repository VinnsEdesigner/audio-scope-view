//! WebSocket client connection management
#![allow(dead_code)]

use uuid::Uuid;

/// Message types for WebSocket communication
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsMessage {
    /// Subscribe to a scope's waveform stream
    #[serde(rename = "subscribe")]
    Subscribe { scope_id: String },
    /// Unsubscribe from a scope
    #[serde(rename = "unsubscribe")]
    Unsubscribe { scope_id: String },
    /// Request spectrum stream
    #[serde(rename = "subscribe_spectrum")]
    SubscribeSpectrum { scope_id: String },
    /// Unsubscribe from spectrum
    #[serde(rename = "unsubscribe_spectrum")]
    UnsubscribeSpectrum { scope_id: String },
    /// Ping/pong for keepalive
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "pong")]
    Pong,
    /// Enable compression
    #[serde(rename = "enable_compression")]
    EnableCompression {
        enabled: bool,
        threshold: Option<usize>,
    },
    /// Error message
    Error { message: String },
}

/// Outgoing messages to client
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type", content = "data")]
pub enum OutgoingMessage {
    /// Waveform data (uncompressed)
    Waveform {
        scope_id: String,
        samples: Vec<f32>,
        timestamp: i64,
        sample_rate: u32,
    },
    /// Waveform data (LZ4 compressed)
    CompressedWaveform {
        scope_id: String,
        data: Vec<u8>,
        sample_count: usize,
        original_size: usize,
        timestamp: i64,
        sample_rate: u32,
    },
    /// Spectrum data
    Spectrum {
        scope_id: String,
        frequencies: Vec<f32>,
        magnitudes: Vec<f32>,
        timestamp: i64,
    },
    /// Analysis results
    Analysis {
        scope_id: String,
        peak_amplitude: f32,
        rms_amplitude: f32,
        dominant_frequency: f32,
        thd: f32,
        snr: f32,
        timestamp: i64,
    },
    /// Subscription confirmed
    Subscribed { scope_id: String, stream_type: String },
    /// Unsubscription confirmed
    Unsubscribed { scope_id: String, stream_type: String },
    /// Pong response
    Pong,
    /// Error message
    Error { message: String },
    /// Connection acknowledged
    Connected { client_id: String },
    /// Compression status
    CompressionStatus { enabled: bool },
    /// Server info message
    ServerInfo {
        version: String,
        sample_rate: u32,
        buffer_size: usize,
    },
}

/// Client connection state
pub struct WsClient {
    pub id: String,
    pub subscribed_scopes: Vec<String>,
    pub subscribed_spectrum: Vec<String>,
    pub compression_enabled: bool,
}

impl WsClient {
    pub fn new() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            subscribed_scopes: Vec::new(),
            subscribed_spectrum: Vec::new(),
            compression_enabled: false,
        }
    }

    pub fn subscribe(&mut self, scope_id: &str) {
        if !self.subscribed_scopes.contains(&scope_id.to_string()) {
            self.subscribed_scopes.push(scope_id.to_string());
        }
    }

    pub fn unsubscribe(&mut self, scope_id: &str) {
        self.subscribed_scopes.retain(|s| s != scope_id);
        self.subscribed_spectrum.retain(|s| s != scope_id);
    }

    pub fn subscribe_spectrum(&mut self, scope_id: &str) {
        if !self.subscribed_spectrum.contains(&scope_id.to_string()) {
            self.subscribed_spectrum.push(scope_id.to_string());
        }
    }

    pub fn unsubscribe_spectrum(&mut self, scope_id: &str) {
        self.subscribed_spectrum.retain(|s| s != scope_id);
    }

    pub fn set_compression(&mut self, enabled: bool) {
        self.compression_enabled = enabled;
    }
}

impl Default for WsClient {
    fn default() -> Self {
        Self::new()
    }
}
