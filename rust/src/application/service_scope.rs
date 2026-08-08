#![allow(dead_code)]

use std::sync::Arc;

use crate::domain::Session;
use crate::infrastructure::repo_trait_session::SessionRepository;
use crate::shared::{AppError, AppResult};

#[derive(Debug, Default, Clone)]
pub struct DspMetrics {
    pub peak_amplitude: Option<f32>,
    pub rms_amplitude: Option<f32>,
    pub dc_offset: Option<f32>,
    pub dominant_frequency: Option<f32>,
    pub frequency_high: Option<f32>,
    pub frequency_low: Option<f32>,
}

pub struct SessionService {
    repository: Arc<dyn SessionRepository>,
}

impl SessionService {
    pub fn new(repository: Arc<dyn SessionRepository>) -> Self {
        Self { repository }
    }

    pub async fn create_session(&self, user_id: String, name: String) -> AppResult<Session> {
        let session = Session::new(uuid::Uuid::new_v4().to_string(), user_id, name);
        self.repository
            .save_session(&session)
            .await
            .map_err(AppError::Domain)?;
        Ok(session)
    }

    pub async fn create_named_session(
        &self,
        user_id: String,
        name: String,
        description: Option<String>,
    ) -> AppResult<Session> {
        let session = Session::new_with_description(uuid::Uuid::new_v4().to_string(), user_id, name, description);
        self.repository
            .save_session(&session)
            .await
            .map_err(AppError::Domain)?;
        Ok(session)
    }

    pub async fn create_sub_session(&self, parent_id: &str, user_id: String, name: String) -> AppResult<Session> {
        let _parent = self.repository
            .find_by_id(parent_id)
            .await
            .map_err(AppError::Domain)?
            .ok_or_else(|| AppError::NotFound("Parent session not found".to_string()))?;

        let session = Session::new_sub_session(uuid::Uuid::new_v4().to_string(), parent_id.to_string(), user_id, name);
        self.repository
            .save_session(&session)
            .await
            .map_err(AppError::Domain)?;
        Ok(session)
    }

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

    pub async fn heartbeat(&self, _id: &str) -> AppResult<()> {
        Ok(())
    }

    pub async fn get(&self, id: &str) -> AppResult<Option<Session>> {
        self.repository
            .find_by_id(id)
            .await
            .map_err(AppError::Domain)
    }

    pub async fn list(&self, limit: u32, offset: u32) -> AppResult<Vec<Session>> {
        self.repository
            .find_all_sessions(limit, offset)
            .await
            .map_err(AppError::Domain)
    }

    pub async fn list_main_sessions(&self, limit: u32, offset: u32) -> AppResult<Vec<Session>> {
        self.repository
            .find_main_sessions(limit, offset)
            .await
            .map_err(AppError::Domain)
    }

    pub async fn delete(&self, id: &str) -> AppResult<bool> {
        self.repository.delete(id).await.map_err(AppError::Domain)
    }

    pub async fn count(&self) -> AppResult<u32> {
        self.repository.count_sessions().await.map_err(AppError::Domain)
    }

    pub async fn get_or_create_active_session(&self) -> AppResult<Session> {
        if let Some(active_session) = self.repository.find_active_session().await.map_err(AppError::Domain)? {
            return Ok(active_session);
        }

        self.create_session().await
    }

    pub async fn get_sub_sessions(&self, parent_id: &str) -> AppResult<Vec<Session>> {
        self.repository
            .find_sub_sessions(parent_id)
            .await
            .map_err(AppError::Domain)
    }

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

    pub async fn count_sub_sessions(&self, parent_id: &str) -> AppResult<u32> {
        self.repository
            .count_sub_sessions(parent_id)
            .await
            .map_err(AppError::Domain)
    }

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