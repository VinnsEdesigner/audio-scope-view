//! Recording GraphQL schema

#![allow(dead_code)]

use async_graphql::{Context, InputObject, Object, SimpleObject};

use crate::api::context_extractor::GraphqlContext;
use crate::domain::recording::{Recording, RecordingSummary, RecordingStats, RecordingFilter, RecordingMetadata, ScopeStatus, SessionWithStatus, TimeRange};

/// Recording output type (full data with samples)
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
    /// Downsampled waveform overview for fast display (max 1000 points)
    pub waveform_overview: Vec<f32>,
}

impl RecordingOutput {
    pub fn from_recording(recording: Recording, session_name: String) -> Self {
        let sample_count = recording.samples.len() as i32;
        // Use stored waveform_overview if available, otherwise compute
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

    /// Create a downsampled waveform overview for fast display
    /// Uses min-max downsampling to preserve waveform shape
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
            // Find min and max in this chunk
            let mut min_val = f32::MAX;
            let mut max_val = f32::MIN;
            for &sample in chunk {
                min_val = min_val.min(sample);
                max_val = max_val.max(sample);
            }
            overview.push(min_val);
            overview.push(max_val);
        }

        // If we're over the limit, truncate (shouldn't happen with proper chunking)
        if overview.len() > max_points * 2 {
            overview.truncate(max_points * 2);
        }

        overview
    }
}

/// Recording preview output (no samples, uses stored waveform_overview)
/// This is much faster for display since it doesn't load audio data
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
    /// Downsampled waveform overview for fast display (max 1000 points)
    pub waveform_overview: Vec<f32>,
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
        }
    }
}

/// Recording summary for lists (no samples)
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

/// Recording statistics output
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

/// Session with status output for home page
#[derive(Debug, SimpleObject)]
pub struct RecordingSessionWithStatusOutput {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub sample_rate: i32,
    pub buffer_size: i32,
    pub created_at: String,
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
            created_at: session.created_at.to_rfc3339(),
            updated_at: session.updated_at.to_rfc3339(),
            last_activity_at: session.last_activity_at.map(|dt| dt.to_rfc3339()),
            recording_count: session.recording_count as i64,
        }
    }
}

/// Session status counts output
#[derive(Debug, SimpleObject)]
pub struct RecordingSessionStatusCountsOutput {
    pub live_count: i64,
    pub paused_count: i64,
    pub offline_count: i64,
    pub total: i64,
}

/// Recording list result output
#[derive(Debug, SimpleObject)]
pub struct RecordingListResultOutput {
    pub recordings: Vec<RecordingSummaryOutput>,
    pub total: i64,
    pub has_more: bool,
}

/// Session list result output
#[derive(Debug, SimpleObject)]
pub struct SessionListResultOutput {
    pub sessions: Vec<RecordingSessionWithStatusOutput>,
    pub total: i64,
    pub has_more: bool,
}

/// Input for recording filters
#[derive(Debug, InputObject)]
pub struct RecordingFilterInput {
    pub session_id: Option<String>,
    pub time_range: Option<String>, // "today", "last_week", "last_month", "all_time"
    pub is_pinned: Option<bool>,
    pub search_query: Option<String>,
}

/// Input for creating a recording
#[derive(Debug, InputObject)]
pub struct CreateRecordingInput {
    pub session_id: String,
    pub name: String,
    pub samples: Vec<f32>,
    pub sample_rate: i32,
}

/// Input for updating a recording
#[derive(Debug, InputObject)]
pub struct UpdateRecordingInput {
    pub name: Option<String>,
    pub is_pinned: Option<bool>,
}

/// Recording query operations
#[derive(Default)]
pub struct RecordingQuery;

#[Object]
impl RecordingQuery {
    /// Get recording by ID (with full samples - use only for playback)
    async fn recording(&self, ctx: &Context<'_>, id: String) -> Option<RecordingOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let recording = context.recording_service.get(&id).await.ok().flatten()?;
        // Since scopes are deprecated, use a placeholder name
        let session_name = "Recording".to_string();
        Some(RecordingOutput::from_recording(recording, session_name))
    }

    /// Get recording preview (without samples, uses stored waveform_overview)
    /// This is much faster for display - use this for UI, not for playback
    async fn recording_preview(&self, ctx: &Context<'_>, id: String) -> Option<RecordingPreviewOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let metadata = context.recording_service.get_metadata(&id).await.ok().flatten()?;
        // Since scopes are deprecated, use a placeholder name
        let session_name = "Recording".to_string();
        Some(RecordingPreviewOutput::from_metadata(metadata, session_name))
    }

    /// Get recordings with filters
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

        // Convert filter input to domain filter
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

        // Since scopes are deprecated, use a placeholder for all recordings
        let recordings_output = result.0
            .into_iter()
            .map(|summary| RecordingSummaryOutput::from_summary(summary, "Recording".to_string()))
            .collect();

        RecordingListResultOutput {
            recordings: recordings_output,
            total: result.1 as i64,
            has_more: result.2,
        }
    }

    /// Get recent recordings across all scopes
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

        // Since scopes are deprecated, use a placeholder for all recordings
        recordings
            .into_iter()
            .map(|summary| RecordingSummaryOutput::from_summary(summary, "Recording".to_string()))
            .collect()
    }

    /// Get recording statistics
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

    /// Get sessions with status
    async fn sessions_with_status(
        &self,
        ctx: &Context<'_>,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> SessionListResultOutput {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let limit = limit.unwrap_or(20).clamp(1, 100) as u32;
        let offset = offset.unwrap_or(0).max(0) as u32;

        context
            .recording_service
            .get_sessions_with_status(limit, offset)
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

    /// Get active sessions with status
    async fn active_sessions_with_status(
        &self,
        ctx: &Context<'_>,
    ) -> Vec<RecordingSessionWithStatusOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        context
            .recording_service
            .get_active_sessions_with_status()
            .await
            .unwrap_or_default()
            .into_iter()
            .map(RecordingSessionWithStatusOutput::from)
            .collect()
    }

    /// Get session status counts
    async fn session_status_counts(&self, ctx: &Context<'_>) -> RecordingSessionStatusCountsOutput {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let counts = context.recording_service.get_session_status_counts().await;
        let total = counts.live + counts.paused + counts.offline;
        RecordingSessionStatusCountsOutput {
            live_count: counts.live as i64,
            paused_count: counts.paused as i64,
            offline_count: counts.offline as i64,
            total: total as i64,
        }
    }

    /// Count recordings by time range
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

/// Recording mutation operations
#[derive(Default)]
pub struct RecordingMutation;

#[Object]
impl RecordingMutation {
    /// Create a new recording
    async fn create_recording(
        &self,
        ctx: &Context<'_>,
        input: CreateRecordingInput,
    ) -> Option<RecordingOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");

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
        // Since scopes are deprecated, use a placeholder name
        Some(RecordingOutput::from_recording(saved, "Recording".to_string()))
    }

    /// Rename a recording
    async fn rename_recording(
        &self,
        ctx: &Context<'_>,
        id: String,
        name: String,
    ) -> Option<RecordingOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let recording = context.recording_service.rename(&id, &name).await.ok()??;
        // Since scopes are deprecated, use a placeholder name
        Some(RecordingOutput::from_recording(recording, "Recording".to_string()))
    }

    /// Toggle recording pin status
    async fn pin_recording(&self, ctx: &Context<'_>, id: String) -> Option<RecordingOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let recording = context.recording_service.toggle_pin(&id).await.ok()??;
        // Since scopes are deprecated, use a placeholder name
        Some(RecordingOutput::from_recording(recording, "Recording".to_string()))
    }

    /// Delete a recording
    async fn delete_recording(&self, ctx: &Context<'_>, id: String) -> bool {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        context.recording_service.delete(&id).await.is_ok()
    }

    /// Delete multiple recordings
    async fn delete_recordings(&self, ctx: &Context<'_>, ids: Vec<String>) -> i64 {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let mut deleted = 0;
        for id in ids {
            if context.recording_service.delete(&id).await.is_ok() {
                deleted += 1;
            }
        }
        deleted
    }

    /// Pin multiple recordings
    async fn pin_recordings(&self, ctx: &Context<'_>, ids: Vec<String>, pinned: bool) -> i64 {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let mut updated = 0;
        for id in &ids {
            if context.recording_service.set_pin(id, pinned).await.is_ok() {
                updated += 1;
            }
        }
        updated
    }
}
