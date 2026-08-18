#![allow(dead_code)]

use async_graphql::{Context, SimpleObject, Subscription};
use futures_util::Stream;
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio_stream::StreamExt;
use tokio_stream::wrappers::BroadcastStream;

use crate::api::context_extractor::device_scope_from_context;
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
    pub thd: f32,
    pub thdn: f32,
    pub snr: f32,
    pub crest_factor: f32,
    pub signal_energy: f32,
    pub noise_energy: f32,
    pub harmonics: Vec<HarmonicComponent>,
}

pub struct SubscriptionRoot;

/// Returns `Ok(())` when the requesting device may subscribe to `session_id`'s
/// stream, or an error otherwise. Unscoped admins (no device id) bypass the
/// check.
async fn check_subscription_access(
    ctx: &Context<'_>,
    session_id: &str,
) -> Result<(), async_graphql::Error> {
    let did = match device_scope_from_context(ctx) {
        Some(d) => d,
        None => return Ok(()),
    };
    let context = ctx
        .data::<crate::api::context_extractor::GraphqlContext>()
        .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;
    let session = context
        .session_service
        .get(session_id)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Failed to load session: {:?}", e)))?
        .ok_or_else(|| async_graphql::Error::new("Session not found"))?;
    if session.user_id != did {
        return Err(async_graphql::Error::new("Session not found"));
    }
    Ok(())
}

#[Subscription]
impl SubscriptionRoot {
    async fn waveform_subscribe(
        &self,
        ctx: &Context<'_>,
        session_id: String,
    ) -> impl Stream<Item = Result<WaveformData, async_graphql::Error>> + 'static {
        // Enforce device isolation: a device must not subscribe to another
        // device's session stream. On denial we return an empty stream.
        let denied = check_subscription_access(ctx, &session_id).await.is_err();
        let ws_state = ctx.data::<Arc<WsState>>().ok().cloned();

        let (tx, rx) = broadcast::channel::<WaveformData>(100);
        if !denied && let Some(state) = ws_state {
            let mut subs = state.waveform_subscribers.write().await;
            subs.insert(session_id.clone(), tx);
        }

        BroadcastStream::new(rx).map(|r| r.map_err(|e| async_graphql::Error::new(e.to_string())))
    }

    async fn spectrum_subscribe(
        &self,
        ctx: &Context<'_>,
        session_id: String,
    ) -> impl Stream<Item = Result<SpectrumData, async_graphql::Error>> + 'static {
        let denied = check_subscription_access(ctx, &session_id).await.is_err();
        let ws_state = ctx.data::<Arc<WsState>>().ok().cloned();

        let (tx, rx) = broadcast::channel::<SpectrumData>(100);
        if !denied && let Some(state) = ws_state {
            let mut subs = state.spectrum_subscribers.write().await;
            subs.insert(session_id.clone(), tx);
        }

        BroadcastStream::new(rx).map(|r| r.map_err(|e| async_graphql::Error::new(e.to_string())))
    }

    async fn stats_subscribe(
        &self,
        ctx: &Context<'_>,
        session_id: String,
    ) -> impl Stream<Item = Result<AudioStats, async_graphql::Error>> + 'static {
        let denied = check_subscription_access(ctx, &session_id).await.is_err();
        let ws_state = ctx.data::<Arc<WsState>>().ok().cloned();

        let (tx, rx) = broadcast::channel::<AudioStats>(50);
        if !denied && let Some(state) = ws_state {
            let mut subs = state.stats_subscribers.write().await;
            subs.insert(session_id.clone(), tx);
        }

        BroadcastStream::new(rx).map(|r| r.map_err(|e| async_graphql::Error::new(e.to_string())))
    }

    async fn analysis_subscribe(
        &self,
        ctx: &Context<'_>,
        session_id: String,
    ) -> impl Stream<Item = Result<AnalysisResult, async_graphql::Error>> + 'static {
        let denied = check_subscription_access(ctx, &session_id).await.is_err();
        let ws_state = ctx.data::<Arc<WsState>>().ok().cloned();

        let (tx, rx) = broadcast::channel::<AnalysisResult>(100);
        if !denied && let Some(state) = ws_state {
            let mut subs = state.analysis_subscribers.write().await;
            subs.insert(session_id.clone(), tx);
        }

        BroadcastStream::new(rx).map(|r| r.map_err(|e| async_graphql::Error::new(e.to_string())))
    }

    async fn all_waveforms(
        &self,
        ctx: &Context<'_>,
    ) -> impl Stream<Item = Result<WaveformData, async_graphql::Error>> + 'static {
        // `all_waveforms` is a global stream with no session scoping. Only allow
        // for unscoped admins; devices get an empty stream to avoid receiving
        // other devices' data.
        let denied = device_scope_from_context(ctx).is_some();
        let ws_state = ctx.data::<Arc<WsState>>().ok().cloned();

        let (tx, rx) = broadcast::channel::<WaveformData>(100);
        if !denied && let Some(state) = ws_state {
            let mut subs = state.all_waveform_subscribers.write().await;
            subs.push(tx);
        }

        BroadcastStream::new(rx).map(|r| r.map_err(|e| async_graphql::Error::new(e.to_string())))
    }
}
