#![allow(dead_code)]

use crate::domain::Session;
use crate::domain::error_domain::DomainError;
use crate::infrastructure::repo_trait_session::{SessionRepository, DomainErrorResult};
use crate::infrastructure::turso_http_client::TursoClient;
use async_trait::async_trait;
use chrono::{DateTime, Utc};

pub struct TursoSessionRepository {
    client: TursoClient,
}

impl TursoSessionRepository {
    pub fn new(client: TursoClient) -> Self {
        Self { client }
    }

    fn map_err(e: crate::shared::error_app::AppError) -> DomainError {
        DomainError::repository(format!("Database error: {}", e))
    }

    fn parse_datetime(s: &str) -> Result<DateTime<Utc>, DomainError> {
        DateTime::parse_from_rfc3339(s)
            .map(|dt| dt.with_timezone(&Utc))
            .or_else(|_| {
                chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
                    .map(|ndt| ndt.and_utc())
            })
            .map_err(|_| DomainError::corruption(format!("Invalid datetime format: {}", s)))
    }

    fn row_to_session(&self, row: &[crate::infrastructure::turso_http_client::TursoValue]) -> Result<Session, DomainError> {
        // Columns: id, user_id, started_at, ended_at, duration_seconds,
        //          oscilloscope_opened_at, oscilloscope_duration_ms, name, description, parent_session_id,
        //          is_sub_session, peak_amplitude, rms_amplitude, dc_offset,
        //          dominant_frequency, frequency_high, frequency_low, auto_close_timeout_secs
        Ok(Session {
            id: row.get(0).and_then(|v| v.as_str()).unwrap_or("").to_string(),
            user_id: row.get(1).and_then(|v| v.as_str())
                .ok_or_else(|| DomainError::corruption("Missing user_id".to_string()))?
                .to_string(),
            started_at: row.get(2).and_then(|v| v.as_str())
                .ok_or_else(|| DomainError::corruption("Missing started_at".to_string()))
                .and_then(|s| Self::parse_datetime(s))?,
            ended_at: row.get(3).and_then(|v| v.as_str()).filter(|s| !s.is_empty())
                .and_then(|s| Self::parse_datetime(s).ok()),
            duration_seconds: row.get(4).and_then(|v| v.as_i64()).map(|v| v as i64),
            oscilloscope_opened_at: row.get(5).and_then(|v| v.as_str()).filter(|s| !s.is_empty())
                .and_then(|s| Self::parse_datetime(s).ok()),
            oscilloscope_duration_ms: row.get(6).and_then(|v| v.as_f64()),
            name: row.get(7).and_then(|v| v.as_str())
                .ok_or_else(|| DomainError::corruption("Missing name".to_string()))?
                .to_string(),
            description: row.get(8).and_then(|v| v.as_str()).filter(|s| !s.is_empty()).map(String::from),
            parent_session_id: row.get(9).and_then(|v| v.as_str()).filter(|s| !s.is_empty()).map(String::from),
            is_sub_session: row.get(10).and_then(|v| v.as_bool()).unwrap_or(false),
            peak_amplitude: row.get(11).and_then(|v| v.as_f64()).map(|v| v as f32),
            rms_amplitude: row.get(12).and_then(|v| v.as_f64()).map(|v| v as f32),
            dc_offset: row.get(13).and_then(|v| v.as_f64()).map(|v| v as f32),
            dominant_frequency: row.get(14).and_then(|v| v.as_f64()).map(|v| v as f32),
            frequency_high: row.get(15).and_then(|v| v.as_f64()).map(|v| v as f32),
            frequency_low: row.get(16).and_then(|v| v.as_f64()).map(|v| v as f32),
            auto_close_timeout_secs: row.get(17).and_then(|v| v.as_i64()).map(|v| v as i32),
        })
    }

    pub async fn save_session(&self, session: &Session) -> DomainErrorResult<()> {
        let user_id = format!("'{}'", session.user_id);
        let name = format!("'{}'", session.name);
        let description = session.description.as_deref()
            .map(|s| format!("'{}'", s))
            .unwrap_or_else(|| "NULL".to_string());
        let parent_session_id = session.parent_session_id.as_deref()
            .map(|s| format!("'{}'", s))
            .unwrap_or_else(|| "NULL".to_string());
            
        let sql = format!(
            r#"INSERT INTO sessions (id, user_id, name, description, started_at, ended_at, duration_seconds, oscilloscope_opened_at, oscilloscope_duration_ms, parent_session_id, is_sub_session, auto_close_timeout_secs, peak_amplitude, rms_amplitude, dc_offset, dominant_frequency, frequency_high, frequency_low)
            VALUES ('{}', {}, {}, {}, '{}', {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})"#,
            session.id,
            user_id,
            name,
            description,
            session.started_at.to_rfc3339(),
            session.ended_at.map(|dt| format!("'{}'", dt.to_rfc3339())).unwrap_or_else(|| "NULL".to_string()),
            session.duration_seconds.map(|v| v.to_string()).unwrap_or_else(|| "NULL".to_string()),
            session.oscilloscope_opened_at.map(|dt| format!("'{}'", dt.to_rfc3339())).unwrap_or_else(|| "NULL".to_string()),
            session.oscilloscope_duration_ms.map(|v| v.to_string()).unwrap_or_else(|| "NULL".to_string()),
            parent_session_id,
            if session.is_sub_session { 1 } else { 0 },
            session.auto_close_timeout_secs.map(|v| v.to_string()).unwrap_or_else(|| "NULL".to_string()),
            session.peak_amplitude.unwrap_or(0.0),
            session.rms_amplitude.unwrap_or(0.0),
            session.dc_offset.unwrap_or(0.0),
            session.dominant_frequency.unwrap_or(0.0),
            session.frequency_high.unwrap_or(0.0),
            session.frequency_low.unwrap_or(0.0),
        );

        self.client.execute_void(&sql).await.map_err(Self::map_err)
    }

    pub async fn update_session(&self, session: &Session) -> DomainErrorResult<()> {
        let user_id = format!("'{}'", session.user_id);
        let name = format!("'{}'", session.name);
        let description = session.description.as_deref()
            .map(|s| format!("'{}'", s))
            .unwrap_or_else(|| "NULL".to_string());
        let parent_session_id = session.parent_session_id.as_deref()
            .map(|s| format!("'{}'", s))
            .unwrap_or_else(|| "NULL".to_string());
            
        let sql = format!(
            r#"UPDATE sessions SET user_id = {}, name = '{}', description = '{}', started_at = '{}', ended_at = {}, duration_seconds = {}, oscilloscope_opened_at = {}, oscilloscope_duration_ms = {}, parent_session_id = '{}', is_sub_session = {}, auto_close_timeout_secs = {}, peak_amplitude = {}, rms_amplitude = {}, dc_offset = {}, dominant_frequency = {}, frequency_high = {}, frequency_low = {} WHERE id = '{}'"#,
            user_id,
            name,
            description,
            session.started_at.to_rfc3339(),
            session.ended_at.map(|dt| format!("'{}'", dt.to_rfc3339())).unwrap_or_else(|| "NULL".to_string()),
            session.duration_seconds.map(|v| v.to_string()).unwrap_or_else(|| "NULL".to_string()),
            session.oscilloscope_opened_at.map(|dt| format!("'{}'", dt.to_rfc3339())).unwrap_or_else(|| "NULL".to_string()),
            session.oscilloscope_duration_ms.map(|v| v.to_string()).unwrap_or_else(|| "NULL".to_string()),
            parent_session_id,
            if session.is_sub_session { 1 } else { 0 },
            session.auto_close_timeout_secs.map(|v| v.to_string()).unwrap_or_else(|| "NULL".to_string()),
            session.peak_amplitude.unwrap_or(0.0),
            session.rms_amplitude.unwrap_or(0.0),
            session.dc_offset.unwrap_or(0.0),
            session.dominant_frequency.unwrap_or(0.0),
            session.frequency_high.unwrap_or(0.0),
            session.frequency_low.unwrap_or(0.0),
            session.id,
        );

        self.client.execute_void(&sql).await.map_err(Self::map_err)
    }

    pub async fn find_by_id(&self, id: &str) -> DomainErrorResult<Option<Session>> {
        let sql = format!("SELECT * FROM sessions WHERE id = '{}'", id);
        let result = self.client.execute(&sql).await.map_err(Self::map_err)?;
        
        if let Some(crate::infrastructure::turso_http_client::TursoResult::Ok(ok)) = result.results.first() {
            if let Some(row) = ok.response.result.rows.first() {
                return Ok(Some(self.row_to_session(row)?));
            }
        }
        Ok(None)
    }

    pub async fn find_active_session(&self) -> DomainErrorResult<Option<Session>> {
        let sql = "SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1";
        let result = self.client.execute(sql).await.map_err(Self::map_err)?;
        
        if let Some(crate::infrastructure::turso_http_client::TursoResult::Ok(ok)) = result.results.first() {
            if let Some(row) = ok.response.result.rows.first() {
                return Ok(Some(self.row_to_session(row)?));
            }
        }
        Ok(None)
    }

    pub async fn find_all_sessions(&self, limit: u32, offset: u32) -> DomainErrorResult<Vec<Session>> {
        let sql = format!("SELECT * FROM sessions ORDER BY started_at DESC LIMIT {} OFFSET {}", limit, offset);
        let result = self.client.execute(&sql).await.map_err(Self::map_err)?;
        
        let mut sessions = Vec::new();
        if let Some(crate::infrastructure::turso_http_client::TursoResult::Ok(ok)) = result.results.first() {
            for row in &ok.response.result.rows {
                sessions.push(self.row_to_session(row)?);
            }
        }
        Ok(sessions)
    }

    pub async fn delete(&self, id: &str) -> DomainErrorResult<bool> {
        let sql = format!("DELETE FROM sessions WHERE id = '{}'", id);
        let result = self.client.execute(&sql).await.map_err(Self::map_err)?;
        
        if let Some(crate::infrastructure::turso_http_client::TursoResult::Ok(ok)) = result.results.first() {
            Ok(ok.response.result.rows_written > 0)
        } else {
            Ok(false)
        }
    }

    pub async fn count_sessions(&self) -> DomainErrorResult<u32> {
        let sql = "SELECT COUNT(*) FROM sessions WHERE is_sub_session = 0";
        let result = self.client.execute(sql).await.map_err(Self::map_err)?;
        
        if let Some(crate::infrastructure::turso_http_client::TursoResult::Ok(ok)) = result.results.first() {
            if let Some(row) = ok.response.result.rows.first() {
                if let Some(count) = row.first().and_then(|v| v.as_i64()) {
                    return Ok(count as u32);
                }
            }
        }
        Ok(0)
    }

    pub async fn count(&self) -> DomainErrorResult<u32> {
        self.count_sessions().await
    }

    pub async fn find_sub_sessions(&self, parent_id: &str) -> DomainErrorResult<Vec<Session>> {
        let sql = format!("SELECT * FROM sessions WHERE parent_session_id = '{}' ORDER BY started_at ASC", parent_id);
        let result = self.client.execute(&sql).await.map_err(Self::map_err)?;
        
        let mut sessions = Vec::new();
        if let Some(crate::infrastructure::turso_http_client::TursoResult::Ok(ok)) = result.results.first() {
            for row in &ok.response.result.rows {
                sessions.push(self.row_to_session(row)?);
            }
        }
        Ok(sessions)
    }

    pub async fn find_sub_sessions_paginated(&self, parent_id: &str, limit: u32, offset: u32) -> DomainErrorResult<Vec<Session>> {
        let sql = format!("SELECT * FROM sessions WHERE parent_session_id = '{}' ORDER BY started_at ASC LIMIT {} OFFSET {}", parent_id, limit, offset);
        let result = self.client.execute(&sql).await.map_err(Self::map_err)?;
        
        let mut sessions = Vec::new();
        if let Some(crate::infrastructure::turso_http_client::TursoResult::Ok(ok)) = result.results.first() {
            for row in &ok.response.result.rows {
                sessions.push(self.row_to_session(row)?);
            }
        }
        Ok(sessions)
    }

    pub async fn count_sub_sessions(&self, parent_id: &str) -> DomainErrorResult<u32> {
        let sql = format!("SELECT COUNT(*) FROM sessions WHERE parent_session_id = '{}'", parent_id);
        let result = self.client.execute(&sql).await.map_err(Self::map_err)?;
        
        if let Some(crate::infrastructure::turso_http_client::TursoResult::Ok(ok)) = result.results.first() {
            if let Some(row) = ok.response.result.rows.first() {
                if let Some(count) = row.first().and_then(|v| v.as_i64()) {
                    return Ok(count as u32);
                }
            }
        }
        Ok(0)
    }

    pub async fn find_main_sessions(&self, limit: u32, offset: u32) -> DomainErrorResult<Vec<Session>> {
        let sql = format!("SELECT * FROM sessions WHERE is_sub_session = 0 ORDER BY started_at DESC LIMIT {} OFFSET {}", limit, offset);
        let result = self.client.execute(&sql).await.map_err(Self::map_err)?;
        
        let mut sessions = Vec::new();
        if let Some(crate::infrastructure::turso_http_client::TursoResult::Ok(ok)) = result.results.first() {
            for row in &ok.response.result.rows {
                sessions.push(self.row_to_session(row)?);
            }
        }
        Ok(sessions)
    }
}

#[async_trait]
impl SessionRepository for TursoSessionRepository {
    async fn save_session(&self, session: &Session) -> DomainErrorResult<()> {
        self.save_session(session).await
    }

    async fn update_session(&self, session: &Session) -> DomainErrorResult<()> {
        self.update_session(session).await
    }

    async fn find_by_id(&self, id: &str) -> DomainErrorResult<Option<Session>> {
        self.find_by_id(id).await
    }

    async fn find_active_session(&self) -> DomainErrorResult<Option<Session>> {
        self.find_active_session().await
    }

    async fn find_all_sessions(&self, limit: u32, offset: u32) -> DomainErrorResult<Vec<Session>> {
        self.find_all_sessions(limit, offset).await
    }

    async fn delete(&self, id: &str) -> DomainErrorResult<bool> {
        self.delete(id).await
    }

    async fn count_sessions(&self) -> DomainErrorResult<u32> {
        self.count_sessions().await
    }

    async fn find_sub_sessions(&self, parent_id: &str) -> DomainErrorResult<Vec<Session>> {
        self.find_sub_sessions(parent_id).await
    }

    async fn find_sub_sessions_paginated(&self, parent_id: &str, limit: u32, offset: u32) -> DomainErrorResult<Vec<Session>> {
        self.find_sub_sessions_paginated(parent_id, limit, offset).await
    }

    async fn count_sub_sessions(&self, parent_id: &str) -> DomainErrorResult<u32> {
        self.count_sub_sessions(parent_id).await
    }

    async fn find_main_sessions(&self, limit: u32, offset: u32) -> DomainErrorResult<Vec<Session>> {
        self.find_main_sessions(limit, offset).await
    }
}
