//! Recording service - Business logic for recording operations

use crate::domain::recording::{Recording, RecordingSummary, RecordingStats, RecordingFilter, ScopeStatus, ScopeWithStatus, TimeRange};
use crate::infrastructure::repo_sqlite_recording::SqliteRecordingRepository;
use crate::infrastructure::repo_sqlite_scope::SqliteScopeRepository;
use crate::shared::{AppError, AppResult};
use std::sync::Arc;

/// Recording service for managing audio recordings
pub struct RecordingService {
    repository: Arc<SqliteRecordingRepository>,
    scope_repository: Arc<SqliteScopeRepository>,
}

impl RecordingService {
    pub fn new(
        repository: Arc<SqliteRecordingRepository>,
        scope_repository: Arc<SqliteScopeRepository>,
    ) -> Self {
        Self {
            repository,
            scope_repository,
        }
    }

    /// Save a recording
    pub async fn save(&self, recording: Recording) -> AppResult<Recording> {
        self.repository
            .save(&recording)
            .await
            .map_err(AppError::Domain)?;
        Ok(recording)
    }

    /// Get a recording by ID
    pub async fn get(&self, id: &str) -> AppResult<Option<Recording>> {
        self.repository
            .find_by_id(id)
            .await
            .map_err(AppError::Domain)
    }

    /// List recordings with filters
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

    /// Get recent recordings
    pub async fn get_recent(&self, limit: u32) -> AppResult<Vec<RecordingSummary>> {
        self.repository
            .get_recent(limit)
            .await
            .map_err(AppError::Domain)
    }

    /// Rename a recording
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

    /// Toggle pin status
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

    /// Set pin status
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

    /// Delete a recording
    pub async fn delete(&self, id: &str) -> AppResult<()> {
        self.repository
            .delete(id)
            .await
            .map_err(AppError::Domain)
    }

    /// Delete multiple recordings
    pub async fn delete_many(&self, ids: &[String]) -> AppResult<u64> {
        self.repository
            .delete_many(ids)
            .await
            .map_err(AppError::Domain)
    }

    /// Get recording statistics
    pub async fn get_stats(
        &self,
        scope_id: Option<&str>,
        time_range: Option<TimeRange>,
    ) -> AppResult<RecordingStats> {
        self.repository
            .get_stats(scope_id, time_range)
            .await
            .map_err(AppError::Domain)
    }

    /// Get recording count by time range
    pub async fn get_recording_count_by_range(
        &self,
        scope_id: Option<&str>,
    ) -> AppResult<RecordingStats> {
        self.repository
            .get_recording_count_by_range(scope_id)
            .await
            .map_err(AppError::Domain)
    }

    /// Get scopes with status
    pub async fn get_scopes_with_status(
        &self,
        limit: u32,
        offset: u32,
    ) -> AppResult<(Vec<ScopeWithStatus>, u64, bool)> {
        let scopes = self.scope_repository
            .find_all(limit, offset)
            .await
            .map_err(AppError::Domain)?;

        let total = self.scope_repository
            .count()
            .await
            .map_err(AppError::Domain)? as u64;

        let mut scopes_with_status: Vec<ScopeWithStatus> = Vec::new();
        for scope in scopes {
            let recording_count = self.repository
                .count_by_scope(&scope.id)
                .await
                .unwrap_or(0);
            scopes_with_status.push(ScopeWithStatus {
                id: scope.id.clone(),
                name: scope.name.clone(),
                description: scope.description.clone(),
                status: if scope.is_active {
                    ScopeStatus::Live
                } else {
                    ScopeStatus::Offline
                },
                sample_rate: scope.sample_rate,
                buffer_size: scope.buffer_size,
                created_at: scope.created_at,
                updated_at: scope.updated_at,
                recording_count,
                last_activity_at: None,
            });
        }

        let has_more = (offset as u64 + limit as u64) < total;
        Ok((scopes_with_status, total, has_more))
    }

    /// Get active scopes with status
    pub async fn get_active_scopes_with_status(&self) -> AppResult<Vec<ScopeWithStatus>> {
        let scopes = self.scope_repository
            .find_active()
            .await
            .map_err(AppError::Domain)?;

        let mut scopes_with_status: Vec<ScopeWithStatus> = Vec::new();
        for scope in scopes {
            let recording_count = self.repository
                .count_by_scope(&scope.id)
                .await
                .unwrap_or(0);
            scopes_with_status.push(ScopeWithStatus {
                id: scope.id.clone(),
                name: scope.name.clone(),
                description: scope.description.clone(),
                status: ScopeStatus::Live,
                sample_rate: scope.sample_rate,
                buffer_size: scope.buffer_size,
                created_at: scope.created_at,
                updated_at: scope.updated_at,
                recording_count,
                last_activity_at: None,
            });
        }

        Ok(scopes_with_status)
    }

    /// Get scope status counts
    pub async fn get_scope_status_counts(&self) -> crate::domain::recording::ScopeStatusCounts {
        // Get all scopes
        let all_scopes = self.scope_repository
            .find_all(1000, 0)
            .await
            .unwrap_or_default();

        let live = all_scopes.iter().filter(|s| s.is_active).count() as u64;
        let offline = all_scopes.iter().filter(|s| !s.is_active).count() as u64;

        crate::domain::recording::ScopeStatusCounts {
            live,
            paused: 0, // TODO: Track paused state
            offline,
        }
    }

    /// Get recording count for a specific scope
    pub async fn get_recording_count_for_scope(&self, scope_id: &str) -> AppResult<u64> {
        self.repository
            .count_by_scope(scope_id)
            .await
            .map_err(AppError::Domain)
    }
}
