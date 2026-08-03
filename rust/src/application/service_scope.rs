#![allow(dead_code)]
//! Session service - Business logic for session operations

use std::sync::Arc;

use crate::domain::Session;
use crate::infrastructure::repo_sqlite_session::SqliteSessionRepository;
use crate::shared::{AppError, AppResult};

/// DSP metrics for audio analysis
#[derive(Debug, Default, Clone)]
pub struct DspMetrics {
    pub peak_amplitude: Option<f32>,
    pub rms_amplitude: Option<f32>,
    pub dc_offset: Option<f32>,
    pub dominant_frequency: Option<f32>,
    pub frequency_high: Option<f32>,
    pub frequency_low: Option<f32>,
}

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

    /// Create a new named session with optional name and description
    pub async fn create_named_session(
        &self,
        name: Option<String>,
        description: Option<String>,
    ) -> AppResult<Session> {
        let session = Session::new_named(uuid::Uuid::new_v4().to_string(), name, description);
        self.repository
            .save_session(&session)
            .await
            .map_err(AppError::Domain)?;
        Ok(session)
    }

    /// Create a sub-session under a parent session
    /// This is automatically called when a capture runs for 30+ seconds
    pub async fn create_sub_session(&self, parent_id: &str) -> AppResult<Session> {
        // Verify parent exists
        let _parent = self.repository
            .find_by_id(parent_id)
            .await
            .map_err(AppError::Domain)?
            .ok_or_else(|| AppError::NotFound("Parent session not found".to_string()))?;

        let session = Session::new_sub_session(uuid::Uuid::new_v4().to_string(), parent_id.to_string());
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

    /// List only main sessions (not sub-sessions) with pagination
    pub async fn list_main_sessions(&self, limit: u32, offset: u32) -> AppResult<Vec<Session>> {
        self.repository
            .find_main_sessions(limit, offset)
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

    /// Get all sub-sessions for a parent session
    pub async fn get_sub_sessions(&self, parent_id: &str) -> AppResult<Vec<Session>> {
        self.repository
            .find_sub_sessions(parent_id)
            .await
            .map_err(AppError::Domain)
    }

    /// Get paginated sub-sessions for a parent session
    pub async fn get_sub_sessions_paginated(
        &self,
        parent_id: &str,
        limit: u32,
        offset: u32,
    ) -> AppResult<Vec<Session>> {
        self.repository
            .find_sub_sessions_paginated(parent_id, limit, offset)
            .await
            .map_err(AppError::Domain)
    }

    /// Count sub-sessions for a parent session
    pub async fn count_sub_sessions(&self, parent_id: &str) -> AppResult<u32> {
        self.repository
            .count_sub_sessions(parent_id)
            .await
            .map_err(AppError::Domain)
    }

    /// Get the parent session of a sub-session
    pub async fn get_parent_session(&self, sub_session_id: &str) -> AppResult<Option<Session>> {
        let sub_session = self.repository
            .find_by_id(sub_session_id)
            .await
            .map_err(AppError::Domain)?
            .ok_or_else(|| AppError::NotFound("Sub-session not found".to_string()))?;

        if let Some(parent_id) = sub_session.parent_session_id {
            self.repository
                .find_by_id(&parent_id)
                .await
                .map_err(AppError::Domain)
        } else {
            Ok(None)
        }
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

    /// Update session name and/or description
    pub async fn update_session_metadata(
        &self,
        id: &str,
        name: Option<String>,
        description: Option<String>,
    ) -> AppResult<Session> {
        let mut session = self.repository
            .find_by_id(id)
            .await
            .map_err(AppError::Domain)?
            .ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;

        if let Some(n) = name {
            session.name = Some(n);
        }
        if let Some(d) = description {
            session.description = Some(d);
        }

        self.repository
            .update_session(&session)
            .await
            .map_err(AppError::Domain)?;
        Ok(session)
    }

    /// Update session DSP metrics from live capture
    /// This is called periodically during oscilloscope capture to store
    /// peak amplitude, RMS amplitude, DC offset, and frequency data
    pub async fn update_session_dsp_metrics(
        &self,
        id: &str,
        metrics: DspMetrics,
    ) -> AppResult<Session> {
        let mut session = self.repository
            .find_by_id(id)
            .await
            .map_err(AppError::Domain)?
            .ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;

        // Update DSP metrics if provided
        if let Some(pa) = metrics.peak_amplitude {
            session.peak_amplitude = Some(pa);
        }
        if let Some(rms) = metrics.rms_amplitude {
            session.rms_amplitude = Some(rms);
        }
        if let Some(dc) = metrics.dc_offset {
            session.dc_offset = Some(dc);
        }
        if let Some(df) = metrics.dominant_frequency {
            session.dominant_frequency = Some(df);
        }
        if let Some(fh) = metrics.frequency_high {
            session.frequency_high = Some(fh);
        }
        if let Some(fl) = metrics.frequency_low {
            session.frequency_low = Some(fl);
        }

        self.repository
            .update_session(&session)
            .await
            .map_err(AppError::Domain)?;
        Ok(session)
    }
}
