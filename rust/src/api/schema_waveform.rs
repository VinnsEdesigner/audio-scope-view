//! Waveform GraphQL schema

use async_graphql::{Context, Object, SimpleObject};
use chrono::Utc;

use crate::api::context_extractor::GraphqlContext;
use crate::domain::Waveform;

/// Waveform output type
#[derive(Debug, SimpleObject)]
pub struct WaveformOutput {
    pub id: String,
    pub scope_id: String,
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
            scope_id: waveform.scope_id,
            samples: waveform.samples,
            sample_count,
            timestamp: waveform.timestamp.to_rfc3339(),
            duration_ms: waveform.duration_ms,
            peak_amplitude: waveform.peak_amplitude,
            rms_amplitude: waveform.rms_amplitude,
        }
    }
}

/// Waveform summary (without samples) for lists
#[derive(Debug, SimpleObject)]
pub struct WaveformSummary {
    pub id: String,
    pub scope_id: String,
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
            scope_id: waveform.scope_id,
            sample_count: waveform.samples.len() as i32,
            timestamp: waveform.timestamp.to_rfc3339(),
            duration_ms: waveform.duration_ms,
            peak_amplitude: waveform.peak_amplitude,
            rms_amplitude: waveform.rms_amplitude,
        }
    }
}

/// Waveform statistics output
#[derive(Debug, SimpleObject)]
pub struct WaveformStatisticsOutput {
    pub total_count: i64,
    pub total_samples: i64,
    pub average_peak: f32,
    pub average_rms: f32,
}

/// Input for creating a waveform manually (for testing)
#[derive(Debug, async_graphql::InputObject)]
pub struct CreateWaveformInput {
    pub scope_id: String,
    pub samples: Vec<f32>,
}

/// Waveform query operations
#[derive(Default)]
pub struct WaveformQuery;

#[Object]
impl WaveformQuery {
    /// Get waveform by ID
    async fn waveform(&self, ctx: &Context<'_>, id: String) -> Option<WaveformOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context
            .waveform_service
            .get(&id)
            .await
            .ok()
            .flatten()
            .map(WaveformOutput::from)
    }

    /// Get waveforms for a scope (with optional full samples)
    async fn waveforms(
        &self,
        ctx: &Context<'_>,
        scope_id: String,
        limit: Option<i32>,
        offset: Option<i32>,
        include_samples: Option<bool>,
    ) -> Vec<WaveformOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        let limit = limit.unwrap_or(20).clamp(1, 100) as u32;
        let offset = offset.unwrap_or(0).max(0) as u32;
        let include_samples = include_samples.unwrap_or(false);

        context
            .waveform_service
            .list_by_scope(&scope_id, limit, offset)
            .await
            .map(|waveforms| {
                waveforms
                    .into_iter()
                    .map(|w| {
                        if include_samples {
                            WaveformOutput::from(w)
                        } else {
                            // Return summary without samples for performance
                            WaveformOutput {
                                id: w.id,
                                scope_id: w.scope_id,
                                samples: vec![], // Empty when not requested
                                sample_count: w.samples.len() as i32,
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

    /// Get recent waveforms for a scope
    async fn recent_waveforms(
        &self,
        ctx: &Context<'_>,
        scope_id: String,
        limit: Option<i32>,
    ) -> Vec<WaveformSummary> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        let limit = limit.unwrap_or(5).clamp(1, 50) as u32;

        context
            .waveform_service
            .get_recent(&scope_id, limit)
            .await
            .map(|waveforms| waveforms.into_iter().map(WaveformSummary::from).collect())
            .unwrap_or_default()
    }

    /// Count waveforms for a scope
    async fn waveform_count(&self, ctx: &Context<'_>, scope_id: String) -> i64 {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context
            .waveform_service
            .count_by_scope(&scope_id)
            .await
            .unwrap_or(0) as i64
    }

    /// Get waveform statistics for a scope
    async fn waveform_statistics(
        &self,
        ctx: &Context<'_>,
        scope_id: String,
    ) -> Option<WaveformStatisticsOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context
            .waveform_service
            .get_statistics(&scope_id)
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

/// Waveform mutation operations
#[derive(Default)]
pub struct WaveformMutation;

#[Object]
impl WaveformMutation {
    /// Create a waveform from sample data
    async fn create_waveform(
        &self,
        ctx: &Context<'_>,
        input: CreateWaveformInput,
    ) -> Option<WaveformOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        // Create waveform from input
        let waveform = crate::domain::Waveform::new(
            uuid::Uuid::new_v4().to_string(),
            input.scope_id,
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

    /// Delete all waveforms for a scope
    async fn delete_waveforms(&self, ctx: &Context<'_>, scope_id: String) -> i64 {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context
            .waveform_service
            .delete_by_scope(&scope_id)
            .await
            .unwrap_or(0) as i64
    }
}
