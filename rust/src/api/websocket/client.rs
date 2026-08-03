//! WebSocket client connection management
#![allow(dead_code)]

use uuid::Uuid;

/// Message types for WebSocket communication
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsMessage {
    /// Subscribe to a scope's waveform stream
    #[serde(rename = "subscribe")]
    Subscribe { session_id: String },
    /// Unsubscribe from a scope
    #[serde(rename = "unsubscribe")]
    Unsubscribe { session_id: String },
    /// Request spectrum stream
    #[serde(rename = "subscribe_spectrum")]
    SubscribeSpectrum { session_id: String },
    /// Unsubscribe from spectrum
    #[serde(rename = "unsubscribe_spectrum")]
    UnsubscribeSpectrum { session_id: String },
    /// Send waveform data TO server (for live capture streaming)
    #[serde(rename = "waveform_data")]
    WaveformData {
        session_id: String,
        samples: Vec<f32>,
        timestamp: i64,
        sample_rate: u32,
        peak_amplitude: f32,
        rms_amplitude: f32,
    },
    /// Send analysis results TO server
    #[serde(rename = "analysis_data")]
    AnalysisData {
        session_id: String,
        peak_amplitude: f32,
        rms_amplitude: f32,
        dominant_frequency: f32,
        frequency_high: f32,
        frequency_low: f32,
        dc_offset: f32,
        timestamp: i64,
    },
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
        session_id: String,
        samples: Vec<f32>,
        timestamp: i64,
        sample_rate: u32,
    },
    /// Waveform data (LZ4 compressed)
    CompressedWaveform {
        session_id: String,
        data: Vec<u8>,
        sample_count: usize,
        original_size: usize,
        timestamp: i64,
        sample_rate: u32,
    },
    /// Spectrum data
    Spectrum {
        session_id: String,
        frequencies: Vec<f32>,
        magnitudes: Vec<f32>,
        timestamp: i64,
    },
    /// Analysis results
    Analysis {
        session_id: String,
        peak_amplitude: f32,
        rms_amplitude: f32,
        dominant_frequency: f32,
        thd: f32,
        snr: f32,
        timestamp: i64,
    },
    /// Subscription confirmed
    Subscribed { session_id: String, stream_type: String },
    /// Unsubscription confirmed
    Unsubscribed { session_id: String, stream_type: String },
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
    pub subscribed_sessions: Vec<String>,
    pub subscribed_spectrum: Vec<String>,
    pub compression_enabled: bool,
}

impl WsClient {
    pub fn new() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            subscribed_sessions: Vec::new(),
            subscribed_spectrum: Vec::new(),
            compression_enabled: false,
        }
    }

    pub fn subscribe(&mut self, session_id: &str) {
        if !self.subscribed_sessions.contains(&session_id.to_string()) {
            self.subscribed_sessions.push(session_id.to_string());
        }
    }

    pub fn unsubscribe(&mut self, session_id: &str) {
        self.subscribed_sessions.retain(|s| s != session_id);
        self.subscribed_spectrum.retain(|s| s != session_id);
    }

    pub fn subscribe_spectrum(&mut self, session_id: &str) {
        if !self.subscribed_spectrum.contains(&session_id.to_string()) {
            self.subscribed_spectrum.push(session_id.to_string());
        }
    }

    pub fn unsubscribe_spectrum(&mut self, session_id: &str) {
        self.subscribed_spectrum.retain(|s| s != session_id);
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
