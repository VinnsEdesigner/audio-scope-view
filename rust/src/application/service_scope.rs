#![allow(dead_code)]
//! Session service - Business logic for session operations

use crate::domain::Session;
use crate::infrastructure::repo_sqlite_session::SqliteSessionRepository;
use crate::shared::{AppError, AppResult};
use std::sync::Arc;

/// Session service for managing oscilloscope sessions
pub struct SessionService {
    repository: Arc<SqliteSessionRepository>,
}

impl SessionService {
    pub fn new(repository: Arc<SqliteSessionRepository>) -> Self {
        Self { repository }
    }

    /// Create a new session (auto-called when canvas opens)
    pub async fn create_session(&self) -> AppResult<Session> {
        let session = Session::new(uuid::Uuid::new_v4().to_string());
        self.repository
            .save_session(&session)
            .await
            .map_err(AppError::Domain)?;
        Ok(session)
    }

    /// End a session and calculate duration
    pub async fn end_session(&self, id: &str) -> AppResult<Session> {
        let mut session = self.repository
            .find_by_id(id)
            .await
            .map_err(AppError::Domain)?
            .ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;
        
        session.end();
        self.repository
            .update_session(&session)
            .await
            .map_err(AppError::Domain)?;
        Ok(session)
    }

    /// Heartbeat to keep session alive (no-op for now, could extend later)
    pub async fn heartbeat(&self, _id: &str) -> AppResult<()> {
        // Sessions are auto-ended by frontend timer, this is a placeholder for future extensions
        Ok(())
    }

    /// Get a session by ID
    pub async fn get(&self, id: &str) -> AppResult<Option<Session>> {
        self.repository
            .find_by_id(id)
            .await
            .map_err(AppError::Domain)
    }

    /// List all sessions with pagination
    pub async fn list(&self, limit: u32, offset: u32) -> AppResult<Vec<Session>> {
        self.repository
            .find_all_sessions(limit, offset)
            .await
            .map_err(AppError::Domain)
    }

    /// Delete a session
    pub async fn delete(&self, id: &str) -> AppResult<bool> {
        self.repository.delete(id).await.map_err(AppError::Domain)
    }

    /// Count total sessions
    pub async fn count(&self) -> AppResult<u32> {
        self.repository.count_sessions().await.map_err(AppError::Domain)
    }
}
