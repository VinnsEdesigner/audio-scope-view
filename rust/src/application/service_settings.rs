#![allow(dead_code)]
//! Settings service - Business logic for settings operations

use crate::domain::{Settings, error_domain::DomainError};
use crate::infrastructure::repo_sqlite_session::SqliteSessionRepository;
use crate::infrastructure::repo_sqlite_settings::SqliteSettingsRepository;
use crate::shared::{AppError, AppResult};
use std::sync::Arc;

/// Settings service for managing scope settings
pub struct SettingsService {
    settings_repository: Arc<SqliteSettingsRepository>,
    session_repository: Arc<SqliteSessionRepository>,
}

impl SettingsService {
    pub fn new(
        settings_repository: Arc<SqliteSettingsRepository>,
        session_repository: Arc<SqliteSessionRepository>,
    ) -> Self {
        Self {
            settings_repository,
            session_repository,
        }
    }

    /// Create default settings for a session
    pub async fn create_for_session(&self, session_id: &str) -> AppResult<Settings> {
        let _session = self
            .session_repository
            .find_by_id(session_id)
            .await
            .map_err(AppError::Domain)?
            .ok_or_else(|| DomainError::not_found("Session", session_id))?;

        let settings = Settings::new(uuid::Uuid::new_v4().to_string(), session_id.to_string());

        self.settings_repository
            .save(&settings)
            .await
            .map_err(AppError::Domain)?;

        Ok(settings)
    }

    /// Get settings by session ID
    pub async fn get_by_session(&self, session_id: &str) -> AppResult<Option<Settings>> {
        self.settings_repository
            .find_by_session_id(session_id)
            .await
            .map_err(AppError::Domain)
    }

    /// Get settings by ID
    pub async fn get(&self, id: &str) -> AppResult<Option<Settings>> {
        self.settings_repository
            .find_by_id(id)
            .await
            .map_err(AppError::Domain)
    }

    /// Update settings
    pub async fn update(&self, settings: Settings) -> AppResult<()> {
        self.settings_repository
            .update(&settings)
            .await
            .map_err(AppError::Domain)
    }

    /// Delete settings for a session
    pub async fn delete_by_session(&self, session_id: &str) -> AppResult<bool> {
        self.settings_repository
            .delete_by_session_id(session_id)
            .await
            .map_err(AppError::Domain)
    }
}
