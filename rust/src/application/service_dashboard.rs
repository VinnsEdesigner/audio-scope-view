//! Dashboard service - Aggregated dashboard data

use crate::domain::entity_dashboard_summary::{DashboardSummary, RecentScope};
use crate::domain::valueobject_timerange::TimeRange;
use crate::infrastructure::repo_sqlite_scope::SqliteScopeRepository;
use crate::infrastructure::repo_sqlite_waveform::SqliteWaveformRepository;
use crate::shared::{AppError, AppResult};
use std::sync::Arc;

/// Dashboard service for aggregated data
pub struct DashboardService {
    scope_repository: Arc<SqliteScopeRepository>,
    waveform_repository: Arc<SqliteWaveformRepository>,
}

impl DashboardService {
    pub fn new(
        scope_repository: Arc<SqliteScopeRepository>,
        waveform_repository: Arc<SqliteWaveformRepository>,
    ) -> Self {
        Self {
            scope_repository,
            waveform_repository,
        }
    }

    /// Get dashboard summary with real waveform statistics
    pub async fn get_summary(&self, time_range: TimeRange) -> AppResult<DashboardSummary> {
        let total_scopes = self
            .scope_repository
            .count()
            .await
            .map_err(AppError::Domain)?;
        let active_scopes = self
            .scope_repository
            .count_active()
            .await
            .map_err(AppError::Domain)?;

        // Get all scopes to aggregate waveform stats
        let all_scopes = self
            .scope_repository
            .find_all(100, 0)
            .await
            .map_err(AppError::Domain)?;

        // Aggregate waveform statistics across all scopes
        let mut total_waveforms: u64 = 0;
        let mut total_samples: u64 = 0;
        let mut total_peak: f32 = 0.0;
        let mut total_rms: f32 = 0.0;
        let mut scopes_with_data: u32 = 0;

        for scope in &all_scopes {
            let stats = self
                .waveform_repository
                .get_statistics(&scope.id)
                .await
                .map_err(AppError::Domain)?;
            if stats.total_count > 0 {
                total_waveforms += stats.total_count;
                total_samples += stats.total_samples;
                total_peak += stats.average_peak;
                total_rms += stats.average_rms;
                scopes_with_data += 1;
            }
        }

        // Calculate averages
        let avg_peak = if scopes_with_data > 0 {
            total_peak / scopes_with_data as f32
        } else {
            0.0
        };
        let avg_rms = if scopes_with_data > 0 {
            total_rms / scopes_with_data as f32
        } else {
            0.0
        };

        let scopes = self
            .scope_repository
            .find_all(5, 0)
            .await
            .map_err(AppError::Domain)?;
        let recent_scopes = scopes
            .into_iter()
            .take(5)
            .map(|s| RecentScope::new(s.id, s.name).with_last_activity(s.updated_at))
            .collect();

        let summary = DashboardSummary::new(time_range)
            .with_scope_stats(total_scopes, active_scopes)
            .with_capture_stats(total_waveforms)
            .with_waveform_stats(total_waveforms, total_samples, avg_peak, avg_rms)
            .with_recent_scopes(recent_scopes);

        Ok(summary)
    }

    /// Get recent scopes
    pub async fn get_recent_scopes(&self, limit: u32) -> AppResult<Vec<RecentScope>> {
        let scopes = self
            .scope_repository
            .find_all(limit, 0)
            .await
            .map_err(AppError::Domain)?;

        Ok(scopes
            .into_iter()
            .take(limit as usize)
            .map(|s| RecentScope::new(s.id, s.name).with_last_activity(s.updated_at))
            .collect())
    }
}
