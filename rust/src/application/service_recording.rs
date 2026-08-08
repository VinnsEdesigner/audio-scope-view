
#![allow(dead_code)]

use crate::domain::recording::{Recording, RecordingSummary, RecordingStats, RecordingFilter, RecordingMetadata, ScopeStatus, SessionWithStatus, TimeRange};
use crate::infrastructure::repo_trait_recording::RecordingRepository;
use crate::infrastructure::repo_trait_session::SessionRepository;
use crate::shared::{AppError, AppResult};
use std::sync::Arc;

pub struct RecordingService {
    repository: Arc<dyn RecordingRepository>,
    session_repository: Arc<dyn SessionRepository>,
}

impl RecordingService {
    pub fn new(
        repository: Arc<dyn RecordingRepository>,
        session_repository: Arc<dyn SessionRepository>,
    ) -> Self {
        Self {
            repository,
            session_repository,
        }
    }

    pub async fn save(&self, recording: Recording) -> AppResult<Recording> {
        self.repository
            .save(&recording)
            .await
            .map_err(AppError::Domain)?;
        Ok(recording)
    }

    pub async fn get(&self, id: &str) -> AppResult<Option<Recording>> {
        self.repository
            .find_by_id(id)
            .await
            .map_err(AppError::Domain)
    }

    pub async fn get_metadata(&self, id: &str) -> AppResult<Option<RecordingMetadata>> {
        self.repository
            .find_metadata_by_id(id)
            .await
            .map_err(AppError::Domain)
    }

    pub async fn list(
        &self,
        filter: Option<&RecordingFilter>,
        limit: u32,
        offset: u32,
    ) -> AppResult<(Vec<RecordingSummary>, u64, bool)> {
        self.repository
            .list(filter, limit, offset)
            .await
            .map_err(AppError::Domain)
    }

    pub async fn get_recent(&self, limit: u32) -> AppResult<Vec<RecordingSummary>> {
        self.repository
            .get_recent(limit)
            .await
            .map_err(AppError::Domain)
    }

    pub async fn rename(&self, id: &str, new_name: &str) -> AppResult<Option<Recording>> {
        let mut recording = match self.repository.find_by_id(id).await.map_err(AppError::Domain)? {
            Some(r) => r,
            None => return Ok(None),
        };
        recording.rename(new_name.to_string());
        self.repository
            .update(&recording)
            .await
            .map_err(AppError::Domain)?;
        Ok(Some(recording))
    }

    pub async fn toggle_pin(&self, id: &str) -> AppResult<Option<Recording>> {
        let mut recording = match self.repository.find_by_id(id).await.map_err(AppError::Domain)? {
            Some(r) => r,
            None => return Ok(None),
        };
        recording.toggle_pin();
        self.repository
            .update(&recording)
            .await
            .map_err(AppError::Domain)?;
        Ok(Some(recording))
    }

    pub async fn set_pin(&self, id: &str, pinned: bool) -> AppResult<Option<Recording>> {
        let mut recording = match self.repository.find_by_id(id).await.map_err(AppError::Domain)? {
            Some(r) => r,
            None => return Ok(None),
        };
        recording.set_pinned(pinned);
        self.repository
            .update(&recording)
            .await
            .map_err(AppError::Domain)?;
        Ok(Some(recording))
    }

    pub async fn delete(&self, id: &str) -> AppResult<()> {
        self.repository
            .delete(id)
            .await
            .map_err(AppError::Domain)
    }

    pub async fn delete_many(&self, ids: &[String]) -> AppResult<u64> {
        self.repository
            .delete_many(ids)
            .await
            .map_err(AppError::Domain)
    }

    pub async fn get_stats(
        &self,
        session_id: Option<&str>,
        time_range: Option<TimeRange>,
    ) -> AppResult<RecordingStats> {
        self.repository
            .get_stats(session_id, time_range)
            .await
            .map_err(AppError::Domain)
    }

    pub async fn get_recording_count_by_range(
        &self,
        session_id: Option<&str>,
    ) -> AppResult<RecordingStats> {
        self.repository
            .get_recording_count_by_range(session_id)
            .await
            .map_err(AppError::Domain)
    }

    pub async fn get_sessions_with_status(
        &self,
        limit: u32,
        offset: u32,
    ) -> AppResult<(Vec<SessionWithStatus>, u64, bool)> {
        let sessions = self.session_repository
            .find_all_sessions(limit, offset)
            .await
            .map_err(AppError::Domain)?;

        let total = self.session_repository
            .count_sessions()
            .await
            .map_err(AppError::Domain)? as u64;

        let mut sessions_with_status: Vec<SessionWithStatus> = Vec::new();
        for session in sessions {
            let recording_count = self.repository
                .count_by_scope(&session.id)
                .await
                .unwrap_or(0);
            let short_id = if session.id.len() >= 8 { &session.id[..8] } else { &session.id };
            sessions_with_status.push(SessionWithStatus {
                id: session.id.clone(),
                name: format!("Session {}", short_id),
                description: None,
                status: if session.ended_at.is_none() {
                    ScopeStatus::Live
                } else {
                    ScopeStatus::Offline
                },
                sample_rate: 44100,
                buffer_size: 1024,
                created_at: session.started_at,
                updated_at: session.ended_at.unwrap_or(session.started_at),
                recording_count,
                last_activity_at: None,
            });
        }

        let has_more = (offset as u64 + limit as u64) < total;
        Ok((sessions_with_status, total, has_more))
    }

    pub async fn get_active_sessions_with_status(&self) -> AppResult<Vec<SessionWithStatus>> {
        let sessions = self.session_repository
            .find_all_sessions(100, 0)
            .await
            .map_err(AppError::Domain)?;

        let active_sessions: Vec<_> = sessions.into_iter().filter(|s| s.ended_at.is_none()).collect();

        let mut sessions_with_status: Vec<SessionWithStatus> = Vec::new();
        for session in active_sessions {
            let recording_count = self.repository
                .count_by_scope(&session.id)
                .await
                .unwrap_or(0);
            let short_id = if session.id.len() >= 8 { &session.id[..8] } else { &session.id };
            sessions_with_status.push(SessionWithStatus {
                id: session.id.clone(),
                name: format!("Session {}", short_id),
                description: None,
                status: ScopeStatus::Live,
                sample_rate: 44100,
                buffer_size: 1024,
                created_at: session.started_at,
                updated_at: session.started_at,
                recording_count,
                last_activity_at: None,
            });
        }

        Ok(sessions_with_status)
    }

    pub async fn get_session_status_counts(&self) -> crate::domain::recording::ScopeStatusCounts {
        let sessions = self.session_repository
            .find_all_sessions(1000, 0)
            .await
            .unwrap_or_default();

        let live = sessions.iter().filter(|s| s.ended_at.is_none()).count() as u64;
        let offline = sessions.iter().filter(|s| s.ended_at.is_some()).count() as u64;

        crate::domain::recording::ScopeStatusCounts {
            live,
            paused: 0,
            offline,
        }
    }

    pub async fn get_recording_count_for_scope(&self, session_id: &str) -> AppResult<u64> {
        self.repository
            .count_by_scope(session_id)
            .await
            .map_err(AppError::Domain)
    }
}