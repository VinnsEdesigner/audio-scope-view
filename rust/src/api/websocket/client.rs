#![allow(dead_code)]

use uuid::Uuid;

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsMessage {
    #[serde(rename = "subscribe")]
    Subscribe {
        session_id: String,
    },
    #[serde(rename = "unsubscribe")]
    Unsubscribe {
        session_id: String,
    },
    #[serde(rename = "subscribe_spectrum")]
    SubscribeSpectrum {
        session_id: String,
    },
    #[serde(rename = "unsubscribe_spectrum")]
    UnsubscribeSpectrum {
        session_id: String,
    },
    #[serde(rename = "waveform_data")]
    WaveformData {
        session_id: String,
        samples: Vec<f32>,
        timestamp: i64,
        sample_rate: u32,
        peak_amplitude: f32,
        rms_amplitude: f32,
    },
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
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "pong")]
    Pong,
    #[serde(rename = "enable_compression")]
    EnableCompression {
        enabled: bool,
        threshold: Option<usize>,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type", content = "data")]
pub enum OutgoingMessage {
    Waveform {
        session_id: String,
        samples: Vec<f32>,
        timestamp: i64,
        sample_rate: u32,
    },
    CompressedWaveform {
        session_id: String,
        data: Vec<u8>,
        sample_count: usize,
        original_size: usize,
        timestamp: i64,
        sample_rate: u32,
    },
    Spectrum {
        session_id: String,
        frequencies: Vec<f32>,
        magnitudes: Vec<f32>,
        timestamp: i64,
    },
    Analysis {
        session_id: String,
        peak_amplitude: f32,
        rms_amplitude: f32,
        dominant_frequency: f32,
        thd: f32,
        snr: f32,
        timestamp: i64,
    },
    Subscribed {
        session_id: String,
        stream_type: String,
    },
    Unsubscribed {
        session_id: String,
        stream_type: String,
    },
    Pong,
    Error {
        message: String,
    },
    Connected {
        client_id: String,
    },
    CompressionStatus {
        enabled: bool,
    },
    ServerInfo {
        version: String,
        sample_rate: u32,
        buffer_size: usize,
    },
}

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
