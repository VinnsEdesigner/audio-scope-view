//! Recording GraphQL schema

use async_graphql::{Context, InputObject, Object, SimpleObject};

use crate::api::context_extractor::GraphqlContext;
use crate::domain::recording::{Recording, RecordingSummary, RecordingStats, RecordingFilter, ScopeStatus, ScopeWithStatus, TimeRange};

/// Recording output type (full data)
#[derive(Debug, SimpleObject)]
pub struct RecordingOutput {
    pub id: String,
    pub scope_id: String,
    pub scope_name: String,
    pub name: String,
    pub samples: Vec<f32>,
    pub sample_count: i32,
    pub timestamp: String,
    pub duration_ms: f64,
    pub size_bytes: i64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
    pub is_pinned: bool,
    pub is_recording: bool,
}

impl RecordingOutput {
    pub fn from_recording(recording: Recording, scope_name: String) -> Self {
        let sample_count = recording.samples.len() as i32;
        Self {
            id: recording.id,
            scope_id: recording.scope_id,
            scope_name,
            name: recording.name,
            samples: recording.samples,
            sample_count,
            timestamp: recording.timestamp.to_rfc3339(),
            duration_ms: recording.duration_ms,
            size_bytes: recording.size_bytes as i64,
            peak_amplitude: recording.peak_amplitude,
            rms_amplitude: recording.rms_amplitude,
            is_pinned: recording.is_pinned,
            is_recording: false,
        }
    }
}

/// Recording summary for lists (no samples)
#[derive(Debug, SimpleObject)]
pub struct RecordingSummaryOutput {
    pub id: String,
    pub scope_id: String,
    pub scope_name: String,
    pub name: String,
    pub timestamp: String,
    pub duration_ms: f64,
    pub size_bytes: i64,
    pub is_pinned: bool,
}

impl RecordingSummaryOutput {
    pub fn from_recording(recording: Recording, scope_name: String) -> Self {
        Self {
            id: recording.id,
            scope_id: recording.scope_id,
            scope_name,
            name: recording.name,
            timestamp: recording.timestamp.to_rfc3339(),
            duration_ms: recording.duration_ms,
            size_bytes: recording.size_bytes as i64,
            is_pinned: recording.is_pinned,
        }
    }
    
    pub fn from_summary(summary: RecordingSummary, scope_name: String) -> Self {
        Self {
            id: summary.id,
            scope_id: summary.scope_id,
            scope_name,
            name: summary.name,
            timestamp: summary.timestamp.to_rfc3339(),
            duration_ms: summary.duration_ms,
            size_bytes: summary.size_bytes as i64,
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

/// Scope with status output for home page
#[derive(Debug, SimpleObject)]
pub struct ScopeWithStatusOutput {
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

impl From<ScopeWithStatus> for ScopeWithStatusOutput {
    fn from(scope: ScopeWithStatus) -> Self {
        let status_str = match scope.status {
            ScopeStatus::Live => "live",
            ScopeStatus::Paused => "paused",
            ScopeStatus::Offline => "offline",
        };
        Self {
            id: scope.id,
            name: scope.name,
            description: scope.description,
            status: status_str.to_string(),
            sample_rate: scope.sample_rate as i32,
            buffer_size: scope.buffer_size as i32,
            created_at: scope.created_at.to_rfc3339(),
            updated_at: scope.updated_at.to_rfc3339(),
            last_activity_at: scope.last_activity_at.map(|dt| dt.to_rfc3339()),
            recording_count: scope.recording_count as i64,
        }
    }
}

/// Scope status counts output
#[derive(Debug, SimpleObject)]
pub struct ScopeStatusCountsOutput {
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

/// Scope list result output
#[derive(Debug, SimpleObject)]
pub struct ScopeListResultOutput {
    pub scopes: Vec<ScopeWithStatusOutput>,
    pub total: i64,
    pub has_more: bool,
}

/// Input for recording filters
#[derive(Debug, InputObject)]
pub struct RecordingFilterInput {
    pub scope_id: Option<String>,
    pub time_range: Option<String>, // "today", "last_week", "last_month", "all_time"
    pub is_pinned: Option<bool>,
    pub search_query: Option<String>,
}

/// Input for creating a recording
#[derive(Debug, InputObject)]
pub struct CreateRecordingInput {
    pub scope_id: String,
    pub name: String,
    pub samples: Vec<f32>,
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
    /// Get recording by ID
    async fn recording(&self, ctx: &Context<'_>, id: String) -> Option<RecordingOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let recording = context.recording_service.get(&id).await.ok().flatten()?;
        let scope_name = context.scope_service.get(&recording.scope_id).await
            .ok().flatten()
            .map(|s| s.name)
            .unwrap_or_else(|| "Unknown".to_string());
        Some(RecordingOutput::from_recording(recording, scope_name))
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
                scope_id: f.scope_id,
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

        // Get scope names for recordings
        let mut recordings_output = Vec::new();
        for summary in result.0 {
            let scope_name = context.scope_service.get(&summary.scope_id).await
                .ok().flatten()
                .map(|s| s.name)
                .unwrap_or_else(|| "Unknown".to_string());
            recordings_output.push(RecordingSummaryOutput::from_summary(summary, scope_name));
        }

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

        // Get scope names for recordings
        let mut result = Vec::new();
        for summary in recordings {
            let scope_name = context.scope_service.get(&summary.scope_id).await
                .ok().flatten()
                .map(|s| s.name)
                .unwrap_or_else(|| "Unknown".to_string());
            result.push(RecordingSummaryOutput::from_summary(summary, scope_name));
        }
        result
    }

    /// Get recording statistics
    async fn recording_stats(
        &self,
        ctx: &Context<'_>,
        scope_id: Option<String>,
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
            .get_stats(scope_id.as_deref(), range)
            .await
            .map(RecordingStatsOutput::from)
            .unwrap_or(RecordingStatsOutput {
                total_recordings: 0,
                total_size_bytes: 0,
                total_duration_ms: 0.0,
                pinned_count: 0,
            })
    }

    /// Get scopes with status
    async fn scopes_with_status(
        &self,
        ctx: &Context<'_>,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> ScopeListResultOutput {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let limit = limit.unwrap_or(20).clamp(1, 100) as u32;
        let offset = offset.unwrap_or(0).max(0) as u32;

        context
            .recording_service
            .get_scopes_with_status(limit, offset)
            .await
            .map(|(scopes, total, has_more)| ScopeListResultOutput {
                scopes: scopes.into_iter().map(ScopeWithStatusOutput::from).collect(),
                total: total as i64,
                has_more,
            })
            .unwrap_or(ScopeListResultOutput {
                scopes: vec![],
                total: 0,
                has_more: false,
            })
    }

    /// Get active scopes with status
    async fn active_scopes_with_status(
        &self,
        ctx: &Context<'_>,
    ) -> Vec<ScopeWithStatusOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        context
            .recording_service
            .get_active_scopes_with_status()
            .await
            .unwrap_or_default()
            .into_iter()
            .map(ScopeWithStatusOutput::from)
            .collect()
    }

    /// Get scope status counts
    async fn scope_status_counts(&self, ctx: &Context<'_>) -> ScopeStatusCountsOutput {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let counts = context.recording_service.get_scope_status_counts().await;
        let total = counts.live + counts.paused + counts.offline;
        ScopeStatusCountsOutput {
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
        scope_id: Option<String>,
    ) -> RecordingStatsOutput {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        context
            .recording_service
            .get_recording_count_by_range(scope_id.as_deref())
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
            input.scope_id.clone(),
            input.name.clone(),
            input.samples,
            44100, // Default sample rate
        );

        let saved = context.recording_service.save(recording).await.ok()?;
        let scope_name = context.scope_service.get(&input.scope_id).await
            .ok().flatten()
            .map(|s| s.name)
            .unwrap_or_else(|| "Unknown".to_string());
        Some(RecordingOutput::from_recording(saved, scope_name))
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
        let scope_name = context.scope_service.get(&recording.scope_id).await
            .ok().flatten()
            .map(|s| s.name)
            .unwrap_or_else(|| "Unknown".to_string());
        Some(RecordingOutput::from_recording(recording, scope_name))
    }

    /// Toggle recording pin status
    async fn pin_recording(&self, ctx: &Context<'_>, id: String) -> Option<RecordingOutput> {
        let context = ctx.data::<GraphqlContext>().expect("Missing GraphqlContext");
        let recording = context.recording_service.toggle_pin(&id).await.ok()??;
        let scope_name = context.scope_service.get(&recording.scope_id).await
            .ok().flatten()
            .map(|s| s.name)
            .unwrap_or_else(|| "Unknown".to_string());
        Some(RecordingOutput::from_recording(recording, scope_name))
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
