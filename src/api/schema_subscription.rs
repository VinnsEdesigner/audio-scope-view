
#![allow(dead_code)]

use async_graphql::{Context, SimpleObject, Subscription};
use futures_util::Stream;
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;

use crate::api::websocket::handler::WsState;

#[derive(Debug, Clone, SimpleObject)]
pub struct WaveformData {
    pub session_id: String,
    pub samples: Vec<f32>,
    pub timestamp: i64,
    pub sample_rate: u32,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
}

#[derive(Debug, Clone, SimpleObject)]
pub struct SpectrumData {
    pub session_id: String,
    pub frequencies: Vec<f32>,
    pub magnitudes: Vec<f32>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, SimpleObject)]
pub struct AudioStats {
    pub session_id: String,
    pub samples_per_second: u32,
    pub dropped_samples: u32,
    pub buffer_fill_percent: f32,
    pub capture_duration_ms: u64,
    pub is_capturing: bool,
}

#[derive(Debug, Clone, SimpleObject)]
pub struct HarmonicComponent {
    pub harmonic: i32,
    pub frequency: f32,
    pub magnitude: f32,
    pub phase: f32,
}

#[derive(Debug, Clone, SimpleObject)]
pub struct FundamentalComponent {
    pub frequency: f32,
    pub magnitude: f32,
    pub phase: f32,
}

#[derive(Debug, Clone, SimpleObject)]
pub struct AnalysisResult {
    pub session_id: String,
    pub timestamp: i64,
    pub sample_rate: u32,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
    pub dc_offset: f32,
    pub dominant_frequency: f32,
    pub fundamental_frequency: f32,
    pub thd: f32,              pub thdn: f32,             pub snr: f32,              pub crest_factor: f32,      pub signal_energy: f32,
    pub noise_energy: f32,
    pub harmonics: Vec<HarmonicComponent>,
}

pub struct SubscriptionRoot;

#[Subscription]
impl SubscriptionRoot {
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