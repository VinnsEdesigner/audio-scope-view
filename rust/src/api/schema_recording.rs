
#![allow(dead_code)]

use async_graphql::{Context, InputObject, Object, SimpleObject};

use crate::api::context_extractor::{GraphqlContext, device_scope_from_context};
use crate::domain::recording::{Recording, RecordingSummary, RecordingStats, RecordingFilter, RecordingMetadata, ScopeStatus, SessionWithStatus, TimeRange};

#[derive(Debug, SimpleObject)]
pub struct RecordingOutput {
    pub id: String,
    pub session_id: String,
    pub session_name: String,
    pub name: String,
    pub samples: Vec<f32>,
    pub sample_count: i32,
    pub sample_rate: i32,
    pub timestamp: String,
    pub duration_ms: f64,
    pub size_bytes: i64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
    pub is_pinned: bool,
    pub is_recording: bool,
    pub waveform_overview: Vec<f32>,
}

impl RecordingOutput {
    pub fn from_recording(recording: Recording, session_name: String) -> Self {
        let sample_count = recording.samples.len() as i32;
        let waveform_overview = Self::create_waveform_overview(&recording.samples, 1000);
        Self {
            id: recording.id,
            session_id: recording.session_id,
            session_name,
            name: recording.name,
            samples: recording.samples,
            sample_count,
            sample_rate: recording.sample_rate as i32,
            timestamp: recording.timestamp.to_rfc3339(),
            duration_ms: recording.duration_ms,
            size_bytes: recording.size_bytes as i64,
            peak_amplitude: recording.peak_amplitude,
            rms_amplitude: recording.rms_amplitude,
            is_pinned: recording.is_pinned,
            is_recording: false,
            waveform_overview,
        }
    }

    fn create_waveform_overview(samples: &[f32], max_points: usize) -> Vec<f32> {
        if samples.is_empty() {
            return vec![];
        }

        if samples.len() <= max_points {
            return samples.to_vec();
        }

        let chunk_size = (samples.len() as f64 / max_points as f64).ceil() as usize;
        let mut overview: Vec<f32> = Vec::with_capacity(max_points * 2);

        for chunk in samples.chunks(chunk_size) {
            if chunk.is_empty() {
                break;
            }
            let mut min_val = f32::MAX;
            let mut max_val = f32::MIN;
            for &sample in chunk {
                min_val = min_val.min(sample);
                max_val = max_val.max(sample);
            }
            overview.push(min_val);
            overview.push(max_val);
        }

        if overview.len() > max_points * 2 {
            overview.truncate(max_points * 2);
        }

        overview
    }
}

#[derive(Debug, SimpleObject)]
pub struct RecordingPreviewOutput {
    pub id: String,
    pub session_id: String,
    pub session_name: String,
    pub name: String,
    pub sample_count: i32,
    pub sample_rate: i32,
    pub timestamp: String,
    pub duration_ms: f64,
    pub size_bytes: i64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
    pub is_pinned: bool,
    pub is_recording: bool,
    pub waveform_overview: Vec<f32>,
    pub peak_db: f32,
    pub rms_db: f32,
    pub dc_offset: f32,
    pub dominant_frequency: f32,
    pub frequency_high: f32,
    pub frequency_low: f32,
    pub bit_depth: i32,
}

impl RecordingPreviewOutput {
    pub fn from_metadata(metadata: RecordingMetadata, session_name: String) -> Self {
        Self {
            id: metadata.id,
            session_id: metadata.session_id,
            session_name,
            name: metadata.name,
            sample_count: metadata.sample_count as i32,
            sample_rate: metadata.sample_rate as i32,
            timestamp: metadata.timestamp.to_rfc3339(),
            duration_ms: metadata.duration_ms,
            size_bytes: metadata.size_bytes as i64,
            peak_amplitude: metadata.peak_amplitude,
            rms_amplitude: metadata.rms_amplitude,
            is_pinned: metadata.is_pinned,
            is_recording: false,
            waveform_overview: metadata.waveform_overview.unwrap_or_default(),
            peak_db: metadata.peak_db,
            rms_db: metadata.rms_db,
            dc_offset: metadata.dc_offset,
            dominant_frequency: metadata.dominant_frequency,
            frequency_high: metadata.frequency_high,
            frequency_low: metadata.frequency_low,
            bit_depth: metadata.bit_depth as i32,
        }
    }
}

#[derive(Debug, SimpleObject)]
pub struct RecordingSummaryOutput {
    pub id: String,
    pub session_id: String,
    pub session_name: String,
    pub name: String,
    pub sample_rate: i32,
    pub timestamp: String,
    pub duration_ms: f64,
    pub size_bytes: i64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
    pub peak_db: f32,
    pub rms_db: f32,
    pub peak_negative_db: f32,
    pub dc_offset: f32,
    pub dominant_frequency: f32,
    pub frequency_high: f32,
    pub frequency_low: f32,
    pub bit_depth: i32,
    pub is_pinned: bool,
}

impl RecordingSummaryOutput {
    pub fn from_recording(recording: Recording, session_name: String) -> Self {
        Self {
            id: recording.id,
            session_id: recording.session_id,
            session_name,
            name: recording.name,
            sample_rate: recording.sample_rate as i32,
            timestamp: recording.timestamp.to_rfc3339(),
            duration_ms: recording.duration_ms,
            size_bytes: recording.size_bytes as i64,
            peak_amplitude: recording.peak_amplitude,
            rms_amplitude: recording.rms_amplitude,
            peak_db: recording.peak_db,
            rms_db: recording.rms_db,
            peak_negative_db: recording.peak_negative_db,
            dc_offset: recording.dc_offset,
            dominant_frequency: recording.dominant_frequency,
            frequency_high: recording.frequency_high,
            frequency_low: recording.frequency_low,
            bit_depth: recording.bit_depth as i32,
            is_pinned: recording.is_pinned,
        }
    }

    pub fn from_summary(summary: RecordingSummary, session_name: String) -> Self {
        Self {
            id: summary.id,
            session_id: summary.session_id,
            session_name,
            name: summary.name,
            sample_rate: summary.sample_rate as i32,
            timestamp: summary.timestamp.to_rfc3339(),
            duration_ms: summary.duration_ms,
            size_bytes: summary.size_bytes as i64,
            peak_amplitude: summary.peak_amplitude,
            rms_amplitude: summary.rms_amplitude,
            peak_db: summary.peak_db,
            rms_db: summary.rms_db,
            peak_negative_db: summary.peak_negative_db,
            dc_offset: summary.dc_offset,
            dominant_frequency: summary.dominant_frequency,
            frequency_high: summary.frequency_high,
            frequency_low: summary.frequency_low,
            bit_depth: summary.bit_depth as i32,
            is_pinned: summary.is_pinned,
        }
    }
}

#[derive(Debug, SimpleObject)]
pub struct RecordingStatsOutput {
    pub total_recordings: i64,
    pub total_size_bytes: i64,
    pub total_duration_ms: f64,
    pub pinned_count: i64,
}

impl From<RecordingStats> for RecordingStatsOutput {
    fn from(stats: RecordingStats) -> Self {
        Self {
            total_recordings: stats.total_recordings as i64,
            total_size_bytes: stats.total_size_bytes as i64,
            total_duration_ms: stats.total_duration_ms,
            pinned_count: stats.pinned_count as i64,
        }
    }
}

#[derive(Debug, SimpleObject)]
pub struct RecordingSessionWithStatusOutput {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub sample_rate: i32,
    pub buffer_size: i32,
    pub started_at: String,
    pub updated_at: String,
    pub last_activity_at: Option<String>,
    pub recording_count: i64,
}

impl From<SessionWithStatus> for RecordingSessionWithStatusOutput {
    fn from(session: SessionWithStatus) -> Self {
        let status_str = match session.status {
            ScopeStatus::Live => "live",
            ScopeStatus::Paused => "paused",
            ScopeStatus::Offline => "offline",
        };
        Self {
            id: session.id,
            name: session.name,
            description: session.description,
            status: status_str.to_string(),
            sample_rate: session.sample_rate as i32,
            buffer_size: session.buffer_size as i32,
            started_at: session.created_at.to_rfc3339(),
            updated_at: session.updated_at.to_rfc3339(),
            last_activity_at: session.last_activity_at.map(|dt| dt.to_rfc3339()),
            recording_count: session.recording_count as i64,
        }
    }
}

#[derive(Debug, SimpleObject)]
pub struct RecordingSessionStatusCountsOutput {
    pub live_count: i64,
    pub paused_count: i64,
    pub offline_count: i64,
    pub total: i64,
}

#[derive(Debug, SimpleObject)]
pub struct RecordingListResultOutput {
    pub recordings: Vec<RecordingSummaryOutput>,
    pub total: i64,
    pub has_more: bool,
}

#[derive(Debug, SimpleObject)]
pub struct SessionListResultOutput {
    pub sessions: Vec<RecordingSessionWithStatusOutput>,
    pub total: i64,
    pub has_more: bool,
}

#[derive(Debug, InputObject)]
pub struct RecordingFilterInput {
    pub session_id: Option<String>,
    pub time_range: Option<String>,     pub is_pinned: Option<bool>,
    pub search_query: Option<String>,
}

#[derive(Debug, InputObject)]
pub struct CreateRecordingInput {
    pub session_id: String,
    pub name: String,
    pub samples: Vec<f32>,
    pub sample_rate: i32,
}

#[derive(Debug, InputObject)]
pub struct UpdateRecordingInput {
    pub name: Option<String>,
    pub is_pinned: Option<bool>,
}

#[derive(Default)]
pub struct RecordingQuery;

/// Returns the set of session ids owned by the requesting device (main + sub).
/// Returns `None` for unscoped admins, meaning "no filtering".
async fn device_session_ids(
    ctx: &Context<'_>,
) -> Result<Option<std::collections::HashSet<String>>, async_graphql::Error> {
    let device_id = match device_scope_from_context(ctx) {
        Some(d) => d,
        None => return Ok(None),
    };
    let context = ctx
        .data::<GraphqlContext>()
        .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;
    let sessions = context
        .session_service
        .list(Some(&device_id), 1000, 0)
        .await
        .unwrap_or_default();
    Ok(Some(sessions.into_iter().map(|s| s.id).collect()))
}

/// Verifies that a single recording belongs to the requesting device (via its
/// session). Unscoped admins bypass the check.
async fn recording_belongs_to_device(
    ctx: &Context<'_>,
    recording: &Recording,
) -> Result<(), async_graphql::Error> {
    let context = ctx
        .data::<GraphqlContext>()
        .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;
    if device_scope_from_context(ctx).is_none() {
        return Ok(());
    }
    let session = context
        .session_service
        .get(&recording.session_id)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Failed to load session: {:?}", e)))?
        .ok_or_else(|| async_graphql::Error::new("Recording not found"))?;
    if let Some(ref did) = device_scope_from_context(ctx) {
        if session.user_id != *did {
            return Err(async_graphql::Error::new("Recording not found"));
        }
    }
    Ok(())
}

/// Verifies that `session_id` belongs to the requesting device. Used by
/// `create_recording` to prevent a device from attaching a recording to another
/// device's session. Unscoped admins bypass the check.
async fn assert_session_belongs_to_device(
    ctx: &Context<'_>,
    session_id: &str,
) -> Result<(), async_graphql::Error> {
    let did = match device_scope_from_context(ctx) {
        Some(d) => d,
        None => return Ok(()),
    };
    let context = ctx
        .data::<GraphqlContext>()
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

#[Object]
impl RecordingQuery {
    async fn recording(&self, ctx: &Context<'_>, id: String) -> Option<RecordingOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let recording = context.recording_service.get(&id).await.ok().flatten()?;
        // Enforce device isolation: a device must not read another device's
        // recording. Returns None (rather than an error) to match the query's
        // Option return type and avoid leaking existence.
        if recording_belongs_to_device(ctx, &recording).await.is_err() {
            return None;
        }
        let session_name = "Recording".to_string();
        Some(RecordingOutput::from_recording(recording, session_name))
    }

    async fn recording_preview(&self, ctx: &Context<'_>, id: String) -> Option<RecordingPreviewOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let metadata = context.recording_service.get_metadata(&id).await.ok().flatten()?;
        // Verify ownership via the underlying recording's session. Fetch the
        // full recording to access session_id for the device check.
        if let Some(recording) = context.recording_service.get(&id).await.ok().flatten() {
            if recording_belongs_to_device(ctx, &recording).await.is_err() {
                return None;
            }
        }
        let session_name = "Recording".to_string();
        Some(RecordingPreviewOutput::from_metadata(metadata, session_name))
    }

    async fn recordings(
        &self,
        ctx: &Context<'_>,
        filter: Option<RecordingFilterInput>,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> RecordingListResultOutput {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let limit = limit.unwrap_or(20).clamp(1, 100) as u32;
        let offset = offset.unwrap_or(0).max(0) as u32;

        let domain_filter = filter.map(|f| {
            let time_range = f.time_range.as_ref().map(|t| match t.as_str() {
                "today" => TimeRange::Today,
                "last_week" => TimeRange::LastWeek,
                "last_month" => TimeRange::LastMonth,
                _ => TimeRange::AllTime,
            });
            RecordingFilter {
                session_id: f.session_id,
                time_range,
                is_pinned: f.is_pinned,
                search_query: f.search_query,
                start_time: None,
                end_time: None,
            }
        });

        let result = context
            .recording_service
            .list(domain_filter.as_ref(), limit, offset)
            .await
            .unwrap_or_default();

        // Scope to the requesting device's sessions. Unscoped admins see all.
        let allowed = device_session_ids(ctx).await.ok().flatten();
        let (recordings_output, total): (Vec<_>, i64) = match allowed {
            Some(set) => {
                let filtered: Vec<_> = result
                    .0
                    .into_iter()
                    .filter(|s| set.contains(&s.session_id))
                    .collect();
                let count = filtered.len() as i64;
                (filtered
                    .into_iter()
                    .map(|summary| RecordingSummaryOutput::from_summary(summary, "Recording".to_string()))
                    .collect(),
                 count)
            }
            None => (
                result
                    .0
                    .into_iter()
                    .map(|summary| RecordingSummaryOutput::from_summary(summary, "Recording".to_string()))
                    .collect(),
                result.1 as i64,
            ),
        };

        RecordingListResultOutput {
            recordings: recordings_output,
            total,
            has_more: result.2,
        }
    }

    async fn recent_recordings(
        &self,
        ctx: &Context<'_>,
        limit: Option<i32>,
    ) -> Vec<RecordingSummaryOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let limit = limit.unwrap_or(10).clamp(1, 50) as u32;

        let recordings = context
            .recording_service
            .get_recent(limit)
            .await
            .unwrap_or_default();

        // Scope to the requesting device's sessions. Unscoped admins see all.
        let allowed = device_session_ids(ctx).await.ok().flatten();
        let recordings: Vec<_> = match allowed {
            Some(set) => recordings.into_iter().filter(|s| set.contains(&s.session_id)).collect(),
            None => recordings,
        };

        recordings
            .into_iter()
            .map(|summary| RecordingSummaryOutput::from_summary(summary, "Recording".to_string()))
            .collect()
    }

    async fn recording_stats(
        &self,
        ctx: &Context<'_>,
        session_id: Option<String>,
        time_range: Option<String>,
    ) -> RecordingStatsOutput {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");

        let range = time_range.as_ref().map(|t| match t.as_str() {
            "today" => TimeRange::Today,
            "last_week" => TimeRange::LastWeek,
            "last_month" => TimeRange::LastMonth,
            _ => TimeRange::AllTime,
        });

        context
            .recording_service
            .get_stats(session_id.as_deref(), range)
            .await
            .map(RecordingStatsOutput::from)
            .unwrap_or(RecordingStatsOutput {
                total_recordings: 0,
                total_size_bytes: 0,
                total_duration_ms: 0.0,
                pinned_count: 0,
            })
    }

    async fn sessions_with_status(
        &self,
        ctx: &Context<'_>,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> SessionListResultOutput {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let limit = limit.unwrap_or(20).clamp(1, 100) as u32;
        let offset = offset.unwrap_or(0).max(0) as u32;
        let device_id = device_scope_from_context(ctx);

        context
            .recording_service
            .get_sessions_with_status(device_id.as_deref(), limit, offset)
            .await
            .map(|(sessions, total, has_more)| SessionListResultOutput {
                sessions: sessions.into_iter().map(RecordingSessionWithStatusOutput::from).collect(),
                total: total as i64,
                has_more,
            })
            .unwrap_or(SessionListResultOutput {
                sessions: vec![],
                total: 0,
                has_more: false,
            })
    }

    async fn active_sessions_with_status(
        &self,
        ctx: &Context<'_>,
    ) -> Vec<RecordingSessionWithStatusOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let device_id = device_scope_from_context(ctx);
        context
            .recording_service
            .get_active_sessions_with_status(device_id.as_deref())
            .await
            .unwrap_or_default()
            .into_iter()
            .map(RecordingSessionWithStatusOutput::from)
            .collect()
    }

    async fn session_status_counts(&self, ctx: &Context<'_>) -> RecordingSessionStatusCountsOutput {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let device_id = device_scope_from_context(ctx);
        let counts = context.recording_service.get_session_status_counts(device_id.as_deref()).await;
        let total = counts.live + counts.paused + counts.offline;
        RecordingSessionStatusCountsOutput {
            live_count: counts.live as i64,
            paused_count: counts.paused as i64,
            offline_count: counts.offline as i64,
            total: total as i64,
        }
    }

    async fn recording_count_by_range(
        &self,
        ctx: &Context<'_>,
        session_id: Option<String>,
    ) -> RecordingStatsOutput {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        context
            .recording_service
            .get_recording_count_by_range(session_id.as_deref())
            .await
            .map(RecordingStatsOutput::from)
            .unwrap_or(RecordingStatsOutput {
                total_recordings: 0,
                total_size_bytes: 0,
                total_duration_ms: 0.0,
                pinned_count: 0,
            })
    }
}

#[derive(Default)]
pub struct RecordingMutation;

#[Object]
impl RecordingMutation {
    async fn create_recording(
        &self,
        ctx: &Context<'_>,
        input: CreateRecordingInput,
    ) -> Option<RecordingOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");

        // Prevent a device from attaching a recording to another device's session.
        if assert_session_belongs_to_device(ctx, &input.session_id).await.is_err() {
            return None;
        }

        let recording = Recording::new(
            uuid::Uuid::new_v4().to_string(),
            input.session_id.clone(),
            input.name.clone(),
            input.samples,
            input.sample_rate as u32,
        );

        let result = context.recording_service.save(recording).await;
        if let Err(e) = &result {
            tracing::error!("Failed to save recording: {}", e);
        }
        let saved = result.ok()?;

        // Get the actual session name
        let session_name = context
            .session_service
            .get(&input.session_id)
            .await
            .ok()
            .flatten()
            .map(|s| s.name)
            .unwrap_or_else(|| "Recording".to_string());

        Some(RecordingOutput::from_recording(saved, session_name))
    }

    async fn rename_recording(
        &self,
        ctx: &Context<'_>,
        id: String,
        name: String,
    ) -> Option<RecordingOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        // Verify ownership before mutating. Fetch the recording first.
        if let Some(rec) = context.recording_service.get(&id).await.ok().flatten() {
            if recording_belongs_to_device(ctx, &rec).await.is_err() {
                return None;
            }
        }
        let recording = context.recording_service.rename(&id, &name).await.ok()??;

        // Get the actual session name
        let session_name = context
            .session_service
            .get(&recording.session_id)
            .await
            .ok()
            .flatten()
            .map(|s| s.name)
            .unwrap_or_else(|| "Recording".to_string());

        Some(RecordingOutput::from_recording(recording, session_name))
    }

    async fn pin_recording(&self, ctx: &Context<'_>, id: String) -> Option<RecordingOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        // Verify ownership before toggling pin.
        if let Some(rec) = context.recording_service.get(&id).await.ok().flatten() {
            if recording_belongs_to_device(ctx, &rec).await.is_err() {
                return None;
            }
        }
        let recording = context.recording_service.toggle_pin(&id).await.ok()??;

        // Get the actual session name
        let session_name = context
            .session_service
            .get(&recording.session_id)
            .await
            .ok()
            .flatten()
            .map(|s| s.name)
            .unwrap_or_else(|| "Recording".to_string());

        Some(RecordingOutput::from_recording(recording, session_name))
    }

    async fn delete_recording(&self, ctx: &Context<'_>, id: String) -> bool {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        // Verify ownership before deleting.
        if let Some(rec) = context.recording_service.get(&id).await.ok().flatten() {
            if recording_belongs_to_device(ctx, &rec).await.is_err() {
                return false;
            }
        }
        context.recording_service.delete(&id).await.is_ok()
    }

    async fn delete_recordings(&self, ctx: &Context<'_>, ids: Vec<String>) -> i64 {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let mut deleted = 0;
        for id in ids {
            // Verify ownership before deleting each recording.
            if let Some(rec) = context.recording_service.get(&id).await.ok().flatten() {
                if recording_belongs_to_device(ctx, &rec).await.is_err() {
                    continue;
                }
            }
            if context.recording_service.delete(&id).await.is_ok() {
                deleted += 1;
            }
        }
        deleted
    }

    async fn pin_recordings(&self, ctx: &Context<'_>, ids: Vec<String>, pinned: bool) -> i64 {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let mut updated = 0;
        for id in &ids {
            // Verify ownership before pinning/unpinning each recording.
            if let Some(rec) = context.recording_service.get(id).await.ok().flatten() {
                if recording_belongs_to_device(ctx, &rec).await.is_err() {
                    continue;
                }
            }
            if context.recording_service.set_pin(id, pinned).await.is_ok() {
                updated += 1;
            }
        }
        updated
    }
}