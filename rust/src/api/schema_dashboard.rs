//! Dashboard GraphQL schema

use async_graphql::{Context, Object, SimpleObject};

use crate::api::context_extractor::GraphqlContext;
use crate::domain::valueobject_timerange::TimeRange;

/// Dashboard summary output
#[derive(Debug, SimpleObject)]
pub struct DashboardSummaryOutput {
    pub time_range: String,
    pub generated_at: String,
    pub total_scopes: i32,
    pub active_scopes: i32,
    pub total_captures: i64,
    pub total_waveforms: i64,
    pub total_samples: i64,
    pub average_peak_amplitude: f32,
    pub average_rms_amplitude: f32,
    pub recent_scopes: Vec<RecentScopeOutput>,
}

/// Recent scope output
#[derive(Debug, SimpleObject)]
pub struct RecentScopeOutput {
    pub id: String,
    pub name: String,
    pub last_activity: String,
    pub waveform_count: i32,
}

/// Dashboard query operations
#[derive(Default)]
pub struct DashboardQuery;

#[Object]
impl DashboardQuery {
    /// Get dashboard summary
    async fn dashboard_summary(
        &self,
        ctx: &Context<'_>,
        time_range: Option<String>,
    ) -> Option<DashboardSummaryOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        let tr = match time_range.as_deref() {
            Some("last_hour") => TimeRange::LastHour,
            Some("last_24_hours") | None => TimeRange::Last24Hours,
            Some("last_7_days") => TimeRange::Last7Days,
            Some("last_30_days") => TimeRange::Last30Days,
            _ => TimeRange::Last24Hours,
        };

        let summary = context.dashboard_service.get_summary(tr).await.ok()?;

        Some(DashboardSummaryOutput {
            time_range: summary.time_range.to_string(),
            generated_at: summary.generated_at.to_rfc3339(),
            total_scopes: summary.total_scopes as i32,
            active_scopes: summary.active_scopes as i32,
            total_captures: summary.total_captures as i64,
            total_waveforms: summary.total_waveforms as i64,
            total_samples: summary.total_samples as i64,
            average_peak_amplitude: summary.average_peak_amplitude,
            average_rms_amplitude: summary.average_rms_amplitude,
            recent_scopes: summary
                .recent_scopes
                .into_iter()
                .map(|rs| RecentScopeOutput {
                    id: rs.id,
                    name: rs.name,
                    last_activity: rs.last_activity.to_rfc3339(),
                    waveform_count: rs.waveform_count as i32,
                })
                .collect(),
        })
    }

    /// Get recent scopes
    async fn recent_scopes(&self, ctx: &Context<'_>, limit: Option<i32>) -> Vec<RecentScopeOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        let limit = limit.unwrap_or(5).clamp(1, 20) as u32;

        context
            .dashboard_service
            .get_recent_scopes(limit)
            .await
            .map(|scopes| {
                scopes
                    .into_iter()
                    .map(|rs| RecentScopeOutput {
                        id: rs.id,
                        name: rs.name,
                        last_activity: rs.last_activity.to_rfc3339(),
                        waveform_count: rs.waveform_count as i32,
                    })
                    .collect()
            })
            .unwrap_or_default()
    }
}
