
use crate::domain::entity_dashboard_summary::{DashboardSummary, RecentScope};
use crate::domain::valueobject_timerange::TimeRange;
use crate::infrastructure::repo_trait_session::SessionRepository;
use crate::domain::trait_waveform_repository::WaveformRepository;
use crate::shared::{AppError, AppResult};
use std::sync::Arc;

pub struct DashboardService {
    session_repository: Arc<dyn SessionRepository>,
    waveform_repository: Arc<dyn WaveformRepository>,
}

impl DashboardService {
    pub fn new(
        session_repository: Arc<dyn SessionRepository>,
        waveform_repository: Arc<dyn WaveformRepository>,
    ) -> Self {
        Self {
            session_repository,
            waveform_repository,
        }
    }

    pub async fn get_summary(&self, time_range: TimeRange) -> AppResult<DashboardSummary> {
        let total_sessions = self
            .session_repository
            .count_sessions()
            .await
            .map_err(AppError::Domain)?;

        let recent_sessions = self
            .session_repository
            .find_all_sessions(5, 0)
            .await
            .map_err(AppError::Domain)?;

        let mut total_waveforms: u64 = 0;
        let mut total_samples: u64 = 0;
        let mut total_peak: f32 = 0.0;
        let mut total_rms: f32 = 0.0;

        for session in &recent_sessions {
            let stats = self
                .waveform_repository
                .get_statistics(&session.id)
                .await
                .map_err(AppError::Domain)?;
            total_waveforms += stats.total_count;
            total_samples += stats.total_samples;
            total_peak += stats.average_peak;
            total_rms += stats.average_rms;
        }

        let session_count = recent_sessions.len() as u32;
        let avg_peak = if session_count > 0 {
            total_peak / session_count as f32
        } else {
            0.0
        };
        let avg_rms = if session_count > 0 {
            total_rms / session_count as f32
        } else {
            0.0
        };

        let recent_sessions = recent_sessions
            .into_iter()
            .map(|s| {
                let short_id = if s.id.len() >= 8 { &s.id[..8] } else { &s.id };
                RecentScope::new(s.id.clone(), format!("Session {}", short_id)).with_last_activity(s.started_at)
            })
            .collect();

        let summary = DashboardSummary::new(time_range)
            .with_scope_stats(total_sessions, 0)             .with_capture_stats(total_waveforms)
            .with_waveform_stats(total_waveforms, total_samples, avg_peak, avg_rms)
            .with_recent_sessions(recent_sessions);

        Ok(summary)
    }

    pub async fn get_recent_sessions(&self, limit: u32) -> AppResult<Vec<RecentScope>> {
        let sessions = self
            .session_repository
            .find_all_sessions(limit, 0)
            .await
            .map_err(AppError::Domain)?;

        Ok(sessions
            .into_iter()
            .take(limit as usize)
            .map(|s| {
                let short_id = if s.id.len() >= 8 { &s.id[..8] } else { &s.id };
                RecentScope::new(s.id.clone(), format!("Session {}", short_id)).with_last_activity(s.started_at)
            })
            .collect())
    }
}