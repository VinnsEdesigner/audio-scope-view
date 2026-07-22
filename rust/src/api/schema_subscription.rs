
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
    pub scope_id: String,
    pub samples: Vec<f32>,
    pub timestamp: i64,
    pub sample_rate: u32,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
}

/// GraphQL output type for spectrum data
#[derive(Debug, Clone, SimpleObject)]
pub struct SpectrumData {
    pub scope_id: String,
    pub frequencies: Vec<f32>,
    pub magnitudes: Vec<f32>,
    pub timestamp: i64,
}

/// GraphQL output type for audio statistics
#[derive(Debug, Clone, SimpleObject)]
pub struct AudioStats {
    pub scope_id: String,
    pub samples_per_second: u32,
    pub dropped_samples: u32,
    pub buffer_fill_percent: f32,
    pub capture_duration_ms: u64,
    pub is_capturing: bool,
}

/// Root subscription type for real-time audio streaming
pub struct SubscriptionRoot;

#[Subscription]
impl SubscriptionRoot {
    /// Subscribe to waveform updates for a specific scope
    async fn waveform_subscribe(
        &self,
        ctx: &Context<'_>,
        scope_id: String,
    ) -> impl Stream<Item = Result<WaveformData, async_graphql::Error>> + 'static {
        let ws_state = ctx.data::<Arc<WsState>>().ok().cloned();
        
        let (tx, rx) = broadcast::channel::<WaveformData>(100);
        if let Some(state) = ws_state {
            let mut subs = state.waveform_subscribers.write().await;
            subs.insert(scope_id.clone(), tx);
        }
        
        BroadcastStream::new(rx)
            .map(|r| r.map_err(|e| async_graphql::Error::new(e.to_string())))
    }

    /// Subscribe to spectrum (FFT) updates for a specific scope
    async fn spectrum_subscribe(
        &self,
        ctx: &Context<'_>,
        scope_id: String,
    ) -> impl Stream<Item = Result<SpectrumData, async_graphql::Error>> + 'static {
        let ws_state = ctx.data::<Arc<WsState>>().ok().cloned();
        
        let (tx, rx) = broadcast::channel::<SpectrumData>(100);
        if let Some(state) = ws_state {
            let mut subs = state.spectrum_subscribers.write().await;
            subs.insert(scope_id.clone(), tx);
        }
        
        BroadcastStream::new(rx)
            .map(|r| r.map_err(|e| async_graphql::Error::new(e.to_string())))
    }

    /// Subscribe to audio statistics for a specific scope
    async fn stats_subscribe(
        &self,
        ctx: &Context<'_>,
        scope_id: String,
    ) -> impl Stream<Item = Result<AudioStats, async_graphql::Error>> + 'static {
        let ws_state = ctx.data::<Arc<WsState>>().ok().cloned();
        
        let (tx, rx) = broadcast::channel::<AudioStats>(50);
        if let Some(state) = ws_state {
            let mut subs = state.stats_subscribers.write().await;
            subs.insert(scope_id.clone(), tx);
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
