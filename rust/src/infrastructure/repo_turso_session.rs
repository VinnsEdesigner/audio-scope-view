#![allow(dead_code)]

use crate::domain::Session;
use crate::domain::error_domain::DomainError;
use crate::infrastructure::repo_trait_session::{DomainErrorResult, SessionRepository};
use crate::infrastructure::turso_http_client::{TursoArg, TursoClient, TursoResult};
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

    fn row_to_session(
        row: &[crate::infrastructure::turso_http_client::TursoValue],
    ) -> Result<Session, DomainError> {
        // Columns: id, user_id, started_at, ended_at, duration_seconds,
        //          oscilloscope_opened_at, oscilloscope_duration_ms, name, description, parent_session_id,
        //          is_sub_session, peak_amplitude, rms_amplitude, dc_offset,
        //          dominant_frequency, frequency_high, frequency_low, auto_close_timeout_secs
        Ok(Session {
            id: row
                .first()
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            user_id: row
                .get(1)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            started_at: row
                .get(2)
                .and_then(|v| v.as_str())
                .ok_or_else(|| DomainError::corruption("Missing started_at".to_string()))
                .and_then(Self::parse_datetime)?,
            ended_at: row
                .get(3)
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .and_then(|s| Self::parse_datetime(s).ok()),
            duration_seconds: row.get(4).and_then(|v| v.as_i64()),
            oscilloscope_opened_at: row
                .get(5)
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .and_then(|s| Self::parse_datetime(s).ok()),
            oscilloscope_duration_ms: row.get(6).and_then(|v| v.as_f64()),
            name: row
                .get(7)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            description: row
                .get(8)
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(String::from),
            parent_session_id: row
                .get(9)
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(String::from),
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

    /// Helper to collect rows from a TursoResponse into parsed Session objects.
    fn collect_sessions(
        result: &crate::infrastructure::turso_http_client::TursoResponse,
    ) -> Result<Vec<Session>, DomainError> {
        let mut sessions = Vec::new();
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            for row in &ok.response.result.rows {
                sessions.push(Self::row_to_session(row)?);
            }
        }
        Ok(sessions)
    }

    /// Helper to extract the first row from a TursoResponse.
    fn first_row(
        result: &crate::infrastructure::turso_http_client::TursoResponse,
    ) -> Result<Option<Session>, DomainError> {
        if let Some(TursoResult::Ok(ok)) = result.results.first()
            && let Some(row) = ok.response.result.rows.first()
        {
            return Ok(Some(Self::row_to_session(row)?));
        }
        Ok(None)
    }
}

#[async_trait]
impl SessionRepository for TursoSessionRepository {
    async fn save_session(&self, session: &Session) -> DomainErrorResult<()> {
        let sql = r#"INSERT INTO sessions (
            id, user_id, name, description, started_at, ended_at, duration_seconds,
            oscilloscope_opened_at, oscilloscope_duration_ms, parent_session_id,
            is_sub_session, auto_close_timeout_secs,
            peak_amplitude, rms_amplitude, dc_offset,
            dominant_frequency, frequency_high, frequency_low
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#;

        self.client
            .execute_void_with_args(
                sql,
                vec![
                    TursoArg::text(&session.id),
                    TursoArg::text(&session.user_id),
                    TursoArg::text(&session.name),
                    TursoArg::opt_text(session.description.clone()),
                    TursoArg::text(session.started_at.to_rfc3339()),
                    TursoArg::opt_text(session.ended_at.map(|dt| dt.to_rfc3339())),
                    TursoArg::opt_integer(session.duration_seconds),
                    TursoArg::opt_text(session.oscilloscope_opened_at.map(|dt| dt.to_rfc3339())),
                    TursoArg::opt_float(session.oscilloscope_duration_ms),
                    TursoArg::opt_text(session.parent_session_id.clone()),
                    TursoArg::bool(session.is_sub_session),
                    TursoArg::opt_integer(session.auto_close_timeout_secs.map(|v| v as i64)),
                    TursoArg::float(session.peak_amplitude.unwrap_or(0.0) as f64),
                    TursoArg::float(session.rms_amplitude.unwrap_or(0.0) as f64),
                    TursoArg::float(session.dc_offset.unwrap_or(0.0) as f64),
                    TursoArg::float(session.dominant_frequency.unwrap_or(0.0) as f64),
                    TursoArg::float(session.frequency_high.unwrap_or(0.0) as f64),
                    TursoArg::float(session.frequency_low.unwrap_or(0.0) as f64),
                ],
            )
            .await
            .map_err(Self::map_err)
    }

    async fn update_session(&self, session: &Session) -> DomainErrorResult<()> {
        let sql = r#"UPDATE sessions SET
            user_id = ?, name = ?, description = ?, started_at = ?, ended_at = ?,
            duration_seconds = ?, oscilloscope_opened_at = ?, oscilloscope_duration_ms = ?,
            parent_session_id = ?, is_sub_session = ?, auto_close_timeout_secs = ?,
            peak_amplitude = ?, rms_amplitude = ?, dc_offset = ?,
            dominant_frequency = ?, frequency_high = ?, frequency_low = ?
            WHERE id = ?"#;

        self.client
            .execute_void_with_args(
                sql,
                vec![
                    TursoArg::text(&session.user_id),
                    TursoArg::text(&session.name),
                    TursoArg::opt_text(session.description.clone()),
                    TursoArg::text(session.started_at.to_rfc3339()),
                    TursoArg::opt_text(session.ended_at.map(|dt| dt.to_rfc3339())),
                    TursoArg::opt_integer(session.duration_seconds),
                    TursoArg::opt_text(session.oscilloscope_opened_at.map(|dt| dt.to_rfc3339())),
                    TursoArg::opt_float(session.oscilloscope_duration_ms),
                    TursoArg::opt_text(session.parent_session_id.clone()),
                    TursoArg::bool(session.is_sub_session),
                    TursoArg::opt_integer(session.auto_close_timeout_secs.map(|v| v as i64)),
                    TursoArg::float(session.peak_amplitude.unwrap_or(0.0) as f64),
                    TursoArg::float(session.rms_amplitude.unwrap_or(0.0) as f64),
                    TursoArg::float(session.dc_offset.unwrap_or(0.0) as f64),
                    TursoArg::float(session.dominant_frequency.unwrap_or(0.0) as f64),
                    TursoArg::float(session.frequency_high.unwrap_or(0.0) as f64),
                    TursoArg::float(session.frequency_low.unwrap_or(0.0) as f64),
                    TursoArg::text(&session.id),
                ],
            )
            .await
            .map_err(Self::map_err)
    }

    async fn find_by_id(&self, id: &str) -> DomainErrorResult<Option<Session>> {
        let sql = "SELECT * FROM sessions WHERE id = ?";
        let result = self
            .client
            .execute_with_args(sql, vec![TursoArg::text(id)])
            .await
            .map_err(Self::map_err)?;
        Self::first_row(&result)
    }

    async fn find_active_session(
        &self,
        device_id: Option<&str>,
    ) -> DomainErrorResult<Option<Session>> {
        let (sql, args) = match device_id {
            Some(d) => (
                "SELECT * FROM sessions WHERE user_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
                vec![TursoArg::text(d)],
            ),
            None => (
                "SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
                vec![],
            ),
        };
        let result = self
            .client
            .execute_with_args(sql, args)
            .await
            .map_err(Self::map_err)?;
        Self::first_row(&result)
    }

    async fn find_all_sessions(
        &self,
        device_id: Option<&str>,
        limit: u32,
        offset: u32,
    ) -> DomainErrorResult<Vec<Session>> {
        let (sql, mut args) = match device_id {
            Some(d) => (
                "SELECT * FROM sessions WHERE is_sub_session = 0 AND user_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?",
                vec![TursoArg::text(d)],
            ),
            None => (
                "SELECT * FROM sessions WHERE is_sub_session = 0 ORDER BY started_at DESC LIMIT ? OFFSET ?",
                vec![],
            ),
        };
        args.push(limit.into());
        args.push(offset.into());
        let result = self
            .client
            .execute_with_args(sql, args)
            .await
            .map_err(Self::map_err)?;
        Self::collect_sessions(&result)
    }

    async fn delete(&self, id: &str) -> DomainErrorResult<bool> {
        let sql = "DELETE FROM sessions WHERE id = ?";
        let result = self
            .client
            .execute_with_args(sql, vec![TursoArg::text(id)])
            .await
            .map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            Ok(ok.response.result.rows_written > 0)
        } else {
            Ok(false)
        }
    }

    async fn count_sessions(&self, device_id: Option<&str>) -> DomainErrorResult<u32> {
        let (sql, args) = match device_id {
            Some(d) => (
                "SELECT COUNT(*) FROM sessions WHERE is_sub_session = 0 AND user_id = ?",
                vec![TursoArg::text(d)],
            ),
            None => (
                "SELECT COUNT(*) FROM sessions WHERE is_sub_session = 0",
                vec![],
            ),
        };
        let result = self
            .client
            .execute_with_args(sql, args)
            .await
            .map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first()
            && let Some(row) = ok.response.result.rows.first()
            && let Some(count) = row.first().and_then(|v| v.as_i64())
        {
            return Ok(count as u32);
        }
        Ok(0)
    }

    async fn find_sub_sessions(&self, parent_id: &str) -> DomainErrorResult<Vec<Session>> {
        let sql = "SELECT * FROM sessions WHERE parent_session_id = ? ORDER BY started_at ASC";
        let result = self
            .client
            .execute_with_args(sql, vec![TursoArg::text(parent_id)])
            .await
            .map_err(Self::map_err)?;
        Self::collect_sessions(&result)
    }

    async fn find_sub_sessions_paginated(
        &self,
        parent_id: &str,
        limit: u32,
        offset: u32,
    ) -> DomainErrorResult<Vec<Session>> {
        let sql = "SELECT * FROM sessions WHERE parent_session_id = ? ORDER BY started_at ASC LIMIT ? OFFSET ?";
        let result = self
            .client
            .execute_with_args(
                sql,
                vec![TursoArg::text(parent_id), limit.into(), offset.into()],
            )
            .await
            .map_err(Self::map_err)?;
        Self::collect_sessions(&result)
    }

    async fn count_sub_sessions(&self, parent_id: &str) -> DomainErrorResult<u32> {
        let sql = "SELECT COUNT(*) FROM sessions WHERE parent_session_id = ?";
        let result = self
            .client
            .execute_with_args(sql, vec![TursoArg::text(parent_id)])
            .await
            .map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first()
            && let Some(row) = ok.response.result.rows.first()
            && let Some(count) = row.first().and_then(|v| v.as_i64())
        {
            return Ok(count as u32);
        }
        Ok(0)
    }

    async fn find_main_sessions(
        &self,
        device_id: Option<&str>,
        limit: u32,
        offset: u32,
    ) -> DomainErrorResult<Vec<Session>> {
        let (sql, mut args) = match device_id {
            Some(d) => (
                "SELECT * FROM sessions WHERE is_sub_session = 0 AND user_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?",
                vec![TursoArg::text(d)],
            ),
            None => (
                "SELECT * FROM sessions WHERE is_sub_session = 0 ORDER BY started_at DESC LIMIT ? OFFSET ?",
                vec![],
            ),
        };
        args.push(limit.into());
        args.push(offset.into());
        let result = self
            .client
            .execute_with_args(sql, args)
            .await
            .map_err(Self::map_err)?;
        Self::collect_sessions(&result)
    }
}
