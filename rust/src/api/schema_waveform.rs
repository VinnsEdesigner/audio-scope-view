
use async_graphql::{Context, Object, SimpleObject};
use chrono::Utc;

use crate::api::context_extractor::{GraphqlContext, device_scope_from_context};
use crate::domain::Waveform;

#[derive(Debug, SimpleObject)]
pub struct WaveformOutput {
    pub id: String,
    pub session_id: String,
    pub samples: Vec<f32>,
    pub sample_count: i32,
    pub timestamp: String,
    pub duration_ms: f64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
}

impl From<Waveform> for WaveformOutput {
    fn from(waveform: Waveform) -> Self {
        let sample_count = waveform.samples.len() as i32;
        Self {
            id: waveform.id,
            session_id: waveform.session_id,
            samples: waveform.samples,
            sample_count,
            timestamp: waveform.timestamp.to_rfc3339(),
            duration_ms: waveform.duration_ms,
            peak_amplitude: waveform.peak_amplitude,
            rms_amplitude: waveform.rms_amplitude,
        }
    }
}

#[derive(Debug, SimpleObject)]
pub struct WaveformSummary {
    pub id: String,
    pub session_id: String,
    pub sample_count: i32,
    pub timestamp: String,
    pub duration_ms: f64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
}

impl From<Waveform> for WaveformSummary {
    fn from(waveform: Waveform) -> Self {
        Self {
            id: waveform.id,
            session_id: waveform.session_id,
            sample_count: waveform.samples.len() as i32,
            timestamp: waveform.timestamp.to_rfc3339(),
            duration_ms: waveform.duration_ms,
            peak_amplitude: waveform.peak_amplitude,
            rms_amplitude: waveform.rms_amplitude,
        }
    }
}

#[derive(Debug, SimpleObject)]
pub struct WaveformStatisticsOutput {
    pub total_count: i64,
    pub total_samples: i64,
    pub average_peak: f32,
    pub average_rms: f32,
}

#[derive(Debug, async_graphql::InputObject)]
pub struct CreateWaveformInput {
    pub session_id: String,
    pub samples: Vec<f32>,
}

#[derive(Default)]
pub struct WaveformQuery;

/// Verifies that the session `session_id` belongs to the requesting device.
/// Unscoped admins (bootstrap key, no device id) bypass the check. This is the
/// core of the device-isolation fix for waveforms: without it, any device could
/// read/delete another device's waveforms by guessing the session id, and could
/// attach a waveform to another device's session via `createWaveform`.
async fn assert_waveform_session_owned(
    ctx: &Context<'_>,
    session_id: &str,
) -> Result<(), async_graphql::Error> {
    let Some(ref did) = device_scope_from_context(ctx) else {
        return Ok(());
    };
    let context = ctx
        .data::<GraphqlContext>()
        .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;
    let session = context
        .session_service
        .get(session_id)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Failed to load session: {:?}", e)))?
        // "not found" rather than "forbidden" to avoid leaking another device's
        // session existence.
        .ok_or_else(|| async_graphql::Error::new("Session not found"))?;
    if session.user_id != *did {
        return Err(async_graphql::Error::new("Session not found"));
    }
    Ok(())
}

/// Verifies that a single waveform belongs to the requesting device (via its
/// session). Unscoped admins bypass the check. Used by `waveform(id)` and
/// `exportWaveform(id)`.
async fn assert_waveform_owned(
    ctx: &Context<'_>,
    waveform_id: &str,
) -> Result<(), async_graphql::Error> {
    // Unscoped admins bypass the check.
    if device_scope_from_context(ctx).is_none() {
        return Ok(());
    }
    let context = ctx
        .data::<GraphqlContext>()
        .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;
    let waveform = context
        .waveform_service
        .get(waveform_id)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Failed to load waveform: {:?}", e)))?
        .ok_or_else(|| async_graphql::Error::new("Waveform not found"))?;
    // Reuse the session ownership check on the waveform's session.
    assert_waveform_session_owned(ctx, &waveform.session_id).await
}

#[Object]
impl WaveformQuery {
    async fn waveform(&self, ctx: &Context<'_>, id: String) -> Option<WaveformOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        let waveform = context.waveform_service.get(&id).await.ok().flatten()?;
        // Enforce device isolation: a device must not read another device's
        // waveform. On denial return None so existence is not leaked.
        if assert_waveform_owned(ctx, &id).await.is_err() {
            return None;
        }
        Some(WaveformOutput::from(waveform))
    }

    async fn waveforms(
        &self,
        ctx: &Context<'_>,
        session_id: String,
        limit: Option<i32>,
        offset: Option<i32>,
        include_samples: Option<bool>,
    ) -> Vec<WaveformOutput> {
        // Enforce device isolation before listing a session's waveforms.
        if assert_waveform_session_owned(ctx, &session_id).await.is_err() {
            return Vec::new();
        }
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        let limit = limit.unwrap_or(20).clamp(1, 100) as u32;
        let offset = offset.unwrap_or(0).max(0) as u32;
        let include_samples = include_samples.unwrap_or(false);

        context
            .waveform_service
            .list_by_session(&session_id, limit, offset)
            .await
            .map(|waveforms| {
                waveforms
                    .into_iter()
                    .map(|w| {
                        if include_samples {
                            WaveformOutput::from(w)
                        } else {
                            WaveformOutput {
                                id: w.id,
                                session_id: w.session_id,
                                samples: vec![],                                 sample_count: w.samples.len() as i32,
                                timestamp: w.timestamp.to_rfc3339(),
                                duration_ms: w.duration_ms,
                                peak_amplitude: w.peak_amplitude,
                                rms_amplitude: w.rms_amplitude,
                            }
                        }
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    async fn recent_waveforms(
        &self,
        ctx: &Context<'_>,
        session_id: String,
        limit: Option<i32>,
    ) -> Vec<WaveformSummary> {
        // Enforce device isolation before listing recent waveforms.
        if assert_waveform_session_owned(ctx, &session_id).await.is_err() {
            return Vec::new();
        }
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        let limit = limit.unwrap_or(5).clamp(1, 50) as u32;

        context
            .waveform_service
            .get_recent(&session_id, limit)
            .await
            .map(|waveforms| waveforms.into_iter().map(WaveformSummary::from).collect())
            .unwrap_or_default()
    }

    async fn waveform_count(&self, ctx: &Context<'_>, session_id: String) -> i64 {
        // Enforce device isolation before reporting counts.
        if assert_waveform_session_owned(ctx, &session_id).await.is_err() {
            return 0;
        }
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context
            .waveform_service
            .count_by_session(&session_id)
            .await
            .unwrap_or(0) as i64
    }

    async fn waveform_statistics(
        &self,
        ctx: &Context<'_>,
        session_id: String,
    ) -> Option<WaveformStatisticsOutput> {
        // Enforce device isolation before reporting statistics.
        if assert_waveform_session_owned(ctx, &session_id).await.is_err() {
            return None;
        }
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context
            .waveform_service
            .get_statistics(&session_id)
            .await
            .ok()
            .map(|stats| WaveformStatisticsOutput {
                total_count: stats.total_count as i64,
                total_samples: stats.total_samples as i64,
                average_peak: stats.average_peak,
                average_rms: stats.average_rms,
            })
    }
}

#[derive(Default)]
pub struct WaveformMutation;

#[Object]
impl WaveformMutation {
    async fn create_waveform(
        &self,
        ctx: &Context<'_>,
        input: CreateWaveformInput,
    ) -> Option<WaveformOutput> {
        // Enforce device isolation: a device must not attach a waveform to
        // another device's session.
        if assert_waveform_session_owned(ctx, &input.session_id).await.is_err() {
            return None;
        }
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        let waveform = crate::domain::Waveform::new(
            uuid::Uuid::new_v4().to_string(),
            input.session_id,
            input.samples,
            Utc::now(),
        );

        context
            .waveform_service
            .save(waveform)
            .await
            .ok()
            .map(WaveformOutput::from)
    }

    async fn delete_waveforms(&self, ctx: &Context<'_>, session_id: String) -> i64 {
        // Enforce device isolation: a device must not delete another device's
        // waveforms.
        if assert_waveform_session_owned(ctx, &session_id).await.is_err() {
            return 0;
        }
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context
            .waveform_service
            .delete_by_session(&session_id)
            .await
            .unwrap_or(0) as i64
    }
}