
use async_graphql::{Context, Object, SimpleObject};
use chrono::Utc;

use crate::api::context_extractor::GraphqlContext;
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

#[Object]
impl WaveformQuery {
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

    async fn waveforms(
        &self,
        ctx: &Context<'_>,
        session_id: String,
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

    async fn recent_waveforms(
        &self,
        ctx: &Context<'_>,
        session_id: String,
        limit: Option<i32>,
    ) -> Vec<WaveformSummary> {
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
