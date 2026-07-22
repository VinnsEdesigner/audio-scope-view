//! Waveform service - Business logic for waveform operations

#![allow(dead_code)]

use crate::domain::{Waveform, WaveformStreamData};
use crate::infrastructure::repo_sqlite_waveform::SqliteWaveformRepository;
use crate::shared::{AppError, AppResult};
use std::sync::Arc;

/// Waveform service for managing captured audio waveforms
pub struct WaveformService {
    repository: Arc<SqliteWaveformRepository>,
}

impl WaveformService {
    pub fn new(repository: Arc<SqliteWaveformRepository>) -> Self {
        Self { repository }
    }

    /// Save a waveform from stream data
    pub async fn save_from_stream(&self, stream_data: WaveformStreamData) -> AppResult<Waveform> {
        let waveform = stream_data.into_waveform(uuid::Uuid::new_v4().to_string());
        self.repository
            .save(&waveform)
            .await
            .map_err(AppError::Domain)?;
        Ok(waveform)
    }

    /// Save a waveform directly
    pub async fn save(&self, waveform: Waveform) -> AppResult<Waveform> {
        self.repository
            .save(&waveform)
            .await
            .map_err(AppError::Domain)?;
        Ok(waveform)
    }

    /// Get a waveform by ID
    pub async fn get(&self, id: &str) -> AppResult<Option<Waveform>> {
        self.repository
            .find_by_id(id)
            .await
            .map_err(AppError::Domain)
    }

    /// List waveforms for a scope with pagination
    pub async fn list_by_scope(
        &self,
        scope_id: &str,
        limit: u32,
        offset: u32,
    ) -> AppResult<Vec<Waveform>> {
        self.repository
            .find_by_scope(scope_id, limit, offset)
            .await
            .map_err(AppError::Domain)
    }

    /// Get recent waveforms for a scope
    pub async fn get_recent(&self, scope_id: &str, limit: u32) -> AppResult<Vec<Waveform>> {
        self.repository
            .find_recent(scope_id, limit)
            .await
            .map_err(AppError::Domain)
    }

    /// Count waveforms for a scope
    pub async fn count_by_scope(&self, scope_id: &str) -> AppResult<u64> {
        self.repository
            .count_by_scope(scope_id)
            .await
            .map_err(AppError::Domain)
    }

    /// Delete all waveforms for a scope
    pub async fn delete_by_scope(&self, scope_id: &str) -> AppResult<u64> {
        self.repository
            .delete_by_scope(scope_id)
            .await
            .map_err(AppError::Domain)
    }

    /// Get waveform statistics for a scope
    pub async fn get_statistics(
        &self,
        scope_id: &str,
    ) -> AppResult<crate::domain::trait_waveform_repository::WaveformStatistics> {
        self.repository
            .get_statistics(scope_id)
            .await
            .map_err(AppError::Domain)
    }
}
