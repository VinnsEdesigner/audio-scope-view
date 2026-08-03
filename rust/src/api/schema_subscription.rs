
#![allow(dead_code)]

use async_graphql::{Context, SimpleObject, Subscription};
use futures_util::Stream;
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;

use crate::api::websocket::handler::WsState;

/// GraphQL output type for waveform data
#[derive(Debug, Clone, SimpleObject)]
pub struct WaveformData {
    pub session_id: String,
    pub samples: Vec<f32>,
    pub timestamp: i64,
    pub sample_rate: u32,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
}

/// GraphQL output type for spectrum data
#[derive(Debug, Clone, SimpleObject)]
pub struct SpectrumData {
    pub session_id: String,
    pub frequencies: Vec<f32>,
    pub magnitudes: Vec<f32>,
    pub timestamp: i64,
}

/// GraphQL output type for audio statistics
#[derive(Debug, Clone, SimpleObject)]
pub struct AudioStats {
    pub session_id: String,
    pub samples_per_second: u32,
    pub dropped_samples: u32,
    pub buffer_fill_percent: f32,
    pub capture_duration_ms: u64,
    pub is_capturing: bool,
}

/// Individual harmonic component
#[derive(Debug, Clone, SimpleObject)]
pub struct HarmonicComponent {
    pub harmonic: i32,
    pub frequency: f32,
    pub magnitude: f32,
    pub phase: f32,
}

/// GraphQL output type for fundamental frequency component
#[derive(Debug, Clone, SimpleObject)]
pub struct FundamentalComponent {
    pub frequency: f32,
    pub magnitude: f32,
    pub phase: f32,
}

/// GraphQL output type for DSP analysis results (calculated on server)
/// This is returned when the server receives waveform data and performs DSP calculations
#[derive(Debug, Clone, SimpleObject)]
pub struct AnalysisResult {
    pub session_id: String,
    pub timestamp: i64,
    pub sample_rate: u32,
    // Basic amplitude metrics
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
    pub dc_offset: f32,
    // Frequency metrics
    pub dominant_frequency: f32,
    pub fundamental_frequency: f32,
    // Signal quality metrics
    pub thd: f32,          // Total Harmonic Distortion (as ratio, multiply by 100 for %)
    pub thdn: f32,         // THD + Noise (as ratio)
    pub snr: f32,          // Signal-to-Noise Ratio in dB
    pub crest_factor: f32,  // Peak/RMS ratio
    // Energy metrics
    pub signal_energy: f32,
    pub noise_energy: f32,
    // Harmonic breakdown (first 10 harmonics)
    pub harmonics: Vec<HarmonicComponent>,
}

/// Root subscription type for real-time audio streaming
pub struct SubscriptionRoot;

#[Subscription]
impl SubscriptionRoot {
    /// Subscribe to waveform updates for a specific scope
    async fn waveform_subscribe(
        &self,
        ctx: &Context<'_>,
        session_id: String,
    ) -> impl Stream<Item = Result<WaveformData, async_graphql::Error>> + 'static {
        let ws_state = ctx.data::<Arc<WsState>>().ok().cloned();
        
        let (tx, rx) = broadcast::channel::<WaveformData>(100);
        if let Some(state) = ws_state {
            let mut subs = state.waveform_subscribers.write().await;
            subs.insert(session_id.clone(), tx);
        }
        
        BroadcastStream::new(rx)
            .map(|r| r.map_err(|e| async_graphql::Error::new(e.to_string())))
    }

    /// Subscribe to spectrum (FFT) updates for a specific scope
    async fn spectrum_subscribe(
        &self,
        ctx: &Context<'_>,
        session_id: String,
    ) -> impl Stream<Item = Result<SpectrumData, async_graphql::Error>> + 'static {
        let ws_state = ctx.data::<Arc<WsState>>().ok().cloned();
        
        let (tx, rx) = broadcast::channel::<SpectrumData>(100);
        if let Some(state) = ws_state {
            let mut subs = state.spectrum_subscribers.write().await;
            subs.insert(session_id.clone(), tx);
        }
        
        BroadcastStream::new(rx)
            .map(|r| r.map_err(|e| async_graphql::Error::new(e.to_string())))
    }

    /// Subscribe to audio statistics for a specific scope
    async fn stats_subscribe(
        &self,
        ctx: &Context<'_>,
        session_id: String,
    ) -> impl Stream<Item = Result<AudioStats, async_graphql::Error>> + 'static {
        let ws_state = ctx.data::<Arc<WsState>>().ok().cloned();
        
        let (tx, rx) = broadcast::channel::<AudioStats>(50);
        if let Some(state) = ws_state {
            let mut subs = state.stats_subscribers.write().await;
            subs.insert(session_id.clone(), tx);
        }
        
        BroadcastStream::new(rx)
            .map(|r| r.map_err(|e| async_graphql::Error::new(e.to_string())))
    }

    /// Subscribe to DSP analysis results for a specific scope
    /// Returns calculated metrics like THD, SNR, crest factor computed by the server
    async fn analysis_subscribe(
        &self,
        ctx: &Context<'_>,
        session_id: String,
    ) -> impl Stream<Item = Result<AnalysisResult, async_graphql::Error>> + 'static {
        let ws_state = ctx.data::<Arc<WsState>>().ok().cloned();
        
        let (tx, rx) = broadcast::channel::<AnalysisResult>(100);
        if let Some(state) = ws_state {
            let mut subs = state.analysis_subscribers.write().await;
            subs.insert(session_id.clone(), tx);
        }
        
        BroadcastStream::new(rx)
            .map(|r| r.map_err(|e| async_graphql::Error::new(e.to_string())))
    }

    /// Subscribe to all waveform updates (no filtering)
    async fn all_waveforms(
        &self,
        ctx: &Context<'_>,
    ) -> impl Stream<Item = Result<WaveformData, async_graphql::Error>> + 'static {
        let ws_state = ctx.data::<Arc<WsState>>().ok().cloned();
        
        let (tx, rx) = broadcast::channel::<WaveformData>(100);
        if let Some(state) = ws_state {
            let mut subs = state.all_waveform_subscribers.write().await;
            subs.push(tx);
        }
        
        BroadcastStream::new(rx)
            .map(|r| r.map_err(|e| async_graphql::Error::new(e.to_string())))
    }
}
