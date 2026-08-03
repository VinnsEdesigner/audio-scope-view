#![allow(dead_code)]
//! Session service - Business logic for session operations

use std::sync::Arc;

use crate::domain::Session;
use crate::infrastructure::repo_sqlite_session::SqliteSessionRepository;
use crate::shared::{AppError, AppResult};

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

    /// Get an active (not ended) session, or create a new one if none exists
    /// This implements the "get or create" pattern for session management
    pub async fn get_or_create_active_session(&self) -> AppResult<Session> {
        // First, try to find an existing active session using efficient query
        if let Some(active_session) = self.repository.find_active_session().await.map_err(AppError::Domain)? {
            return Ok(active_session);
        }
        
        // No active session found, create a new one
        self.create_session().await
    }

    /// Open oscilloscope capture (starts tracking time)
    pub async fn open_oscilloscope(&self, id: &str) -> AppResult<Session> {
        let mut session = self.repository
            .find_by_id(id)
            .await
            .map_err(AppError::Domain)?
            .ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;
        
        session.open_oscilloscope();
        self.repository
            .update_session(&session)
            .await
            .map_err(AppError::Domain)?;
        Ok(session)
    }

    /// Close oscilloscope capture (calculates and accumulates duration)
    pub async fn close_oscilloscope(&self, id: &str) -> AppResult<Session> {
        let mut session = self.repository
            .find_by_id(id)
            .await
            .map_err(AppError::Domain)?
            .ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;
        
        session.close_oscilloscope();
        self.repository
            .update_session(&session)
            .await
            .map_err(AppError::Domain)?;
        Ok(session)
    }
}
