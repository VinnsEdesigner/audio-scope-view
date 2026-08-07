#![allow(dead_code)]

use crate::domain::{Session, error_domain::DomainError};
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use sqlx::SqlitePool;

#[derive(FromRow)]
struct SessionRow {
    id: String,
    user_id: Option<String>,
    name: Option<String>,
    description: Option<String>,
    started_at: String,
    ended_at: Option<String>,
    duration_seconds: Option<i64>,
    oscilloscope_opened_at: Option<String>,
    oscilloscope_duration_ms: Option<f64>,
    parent_session_id: Option<String>,
    is_sub_session: bool,
    auto_close_timeout_secs: Option<i32>,
    peak_amplitude: f32,
    rms_amplitude: f32,
    dc_offset: f32,
    dominant_frequency: f32,
    frequency_high: f32,
    frequency_low: f32,
}

impl TryFrom<SessionRow> for Session {
    type Error = DomainError;

    fn try_from(row: SessionRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.id,
            user_id: row.user_id,
            name: row.name,
            description: row.description,
            started_at: parse_datetime(&row.started_at)?,
            ended_at: row.ended_at.and_then(|s| parse_datetime(&s).ok()),
            duration_seconds: row.duration_seconds,
            oscilloscope_opened_at: row.oscilloscope_opened_at.and_then(|s| parse_datetime(&s).ok()),
            oscilloscope_duration_ms: row.oscilloscope_duration_ms,
            parent_session_id: row.parent_session_id,
            is_sub_session: row.is_sub_session,
            auto_close_timeout_secs: row.auto_close_timeout_secs,
            peak_amplitude: Some(row.peak_amplitude),
            rms_amplitude: Some(row.rms_amplitude),
            dc_offset: Some(row.dc_offset),
            dominant_frequency: Some(row.dominant_frequency),
            frequency_high: Some(row.frequency_high),
            frequency_low: Some(row.frequency_low),
        })
    }
}

fn parse_datetime(s: &str) -> Result<DateTime<Utc>, DomainError> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .or_else(|_| {
            chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").map(|ndt| ndt.and_utc())
        })
        .map_err(|_| DomainError::corruption(format!("Invalid datetime format: {}", s)))
}

pub struct SqliteSessionRepository {
    pool: SqlitePool,
}

impl SqliteSessionRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

impl SqliteSessionRepository {
    pub async fn save_session(&self, session: &Session) -> DomainErrorResult<()> {
        sqlx::query(
            r#"
            INSERT INTO sessions (id, user_id, name, description, started_at, ended_at, duration_seconds, oscilloscope_opened_at, oscilloscope_duration_ms, parent_session_id, is_sub_session, auto_close_timeout_secs, peak_amplitude, rms_amplitude, dc_offset, dominant_frequency, frequency_high, frequency_low)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&session.id)
        .bind(&session.user_id)
        .bind(&session.name)
        .bind(&session.description)
        .bind(session.started_at.to_rfc3339())
        .bind(session.ended_at.map(|dt| dt.to_rfc3339()))
        .bind(session.duration_seconds)
        .bind(session.oscilloscope_opened_at.map(|dt| dt.to_rfc3339()))
        .bind(session.oscilloscope_duration_ms)
        .bind(&session.parent_session_id)
        .bind(session.is_sub_session)
        .bind(session.auto_close_timeout_secs)
        .bind(session.peak_amplitude.unwrap_or(0.0))
        .bind(session.rms_amplitude.unwrap_or(0.0))
        .bind(session.dc_offset.unwrap_or(0.0))
        .bind(session.dominant_frequency.unwrap_or(0.0))
        .bind(session.frequency_high.unwrap_or(0.0))
        .bind(session.frequency_low.unwrap_or(0.0))
        .execute(&self.pool)
        .await
        .map_err(map_sqlx_err)?;
        Ok(())
    }

    pub async fn update_session(&self, session: &Session) -> DomainErrorResult<()> {
        sqlx::query(
            r#"
            UPDATE sessions
            SET user_id = ?, name = ?, description = ?, started_at = ?, ended_at = ?, duration_seconds = ?, oscilloscope_opened_at = ?, oscilloscope_duration_ms = ?, parent_session_id = ?, is_sub_session = ?, auto_close_timeout_secs = ?, peak_amplitude = ?, rms_amplitude = ?, dc_offset = ?, dominant_frequency = ?, frequency_high = ?, frequency_low = ?
            WHERE id = ?
            "#,
        )
        .bind(&session.user_id)
        .bind(&session.name)
        .bind(&session.description)
        .bind(session.started_at.to_rfc3339())
        .bind(session.ended_at.map(|dt| dt.to_rfc3339()))
        .bind(session.duration_seconds)
        .bind(session.oscilloscope_opened_at.map(|dt| dt.to_rfc3339()))
        .bind(session.oscilloscope_duration_ms)
        .bind(&session.parent_session_id)
        .bind(session.is_sub_session)
        .bind(session.auto_close_timeout_secs)
        .bind(session.peak_amplitude.unwrap_or(0.0))
        .bind(session.rms_amplitude.unwrap_or(0.0))
        .bind(session.dc_offset.unwrap_or(0.0))
        .bind(session.dominant_frequency.unwrap_or(0.0))
        .bind(session.frequency_high.unwrap_or(0.0))
        .bind(session.frequency_low.unwrap_or(0.0))
        .bind(&session.id)
        .execute(&self.pool)
        .await
        .map_err(map_sqlx_err)?;
        Ok(())
    }

    pub async fn find_by_id(&self, id: &str) -> DomainErrorResult<Option<Session>> {
        let row: Option<SessionRow> = sqlx::query_as("SELECT * FROM sessions WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_sqlx_err)?;

        match row {
            Some(r) => Ok(Some(r.try_into()?)),
            None => Ok(None),
        }
    }

    pub async fn find_active_session(&self) -> DomainErrorResult<Option<Session>> {
        let row: Option<SessionRow> = sqlx::query_as(
            "SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(map_sqlx_err)?;

        match row {
            Some(r) => Ok(Some(r.try_into()?)),
            None => Ok(None),
        }
    }

    pub async fn find_all_sessions(&self, limit: u32, offset: u32) -> DomainErrorResult<Vec<Session>> {
        let rows: Vec<SessionRow> =
            sqlx::query_as("SELECT * FROM sessions ORDER BY started_at DESC LIMIT ? OFFSET ?")
                .bind(limit as i32)
                .bind(offset as i32)
                .fetch_all(&self.pool)
                .await
                .map_err(map_sqlx_err)?;

        rows.into_iter().map(TryInto::try_into).collect()
    }

    pub async fn delete(&self, id: &str) -> DomainErrorResult<bool> {
        let result = sqlx::query("DELETE FROM sessions WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_sqlx_err)?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn count_sessions(&self) -> DomainErrorResult<u32> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sessions WHERE is_sub_session = FALSE",
        )
            .fetch_one(&self.pool)
            .await
            .map_err(map_sqlx_err)?;
        Ok(row.0 as u32)
    }

    pub async fn count(&self) -> DomainErrorResult<u32> {
        self.count_sessions().await
    }

    pub async fn find_sub_sessions(&self, parent_id: &str) -> DomainErrorResult<Vec<Session>> {
        let rows: Vec<SessionRow> = sqlx::query_as(
            "SELECT * FROM sessions WHERE parent_session_id = ? ORDER BY started_at ASC"
        )
        .bind(parent_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_sqlx_err)?;

        rows.into_iter().map(TryInto::try_into).collect()
    }

    pub async fn find_sub_sessions_paginated(
        &self,
        parent_id: &str,
        limit: u32,
        offset: u32,
    ) -> DomainErrorResult<Vec<Session>> {
        let rows: Vec<SessionRow> = sqlx::query_as(
            "SELECT * FROM sessions WHERE parent_session_id = ? ORDER BY started_at ASC LIMIT ? OFFSET ?"
        )
        .bind(parent_id)
        .bind(limit as i32)
        .bind(offset as i32)
        .fetch_all(&self.pool)
        .await
        .map_err(map_sqlx_err)?;

        rows.into_iter().map(TryInto::try_into).collect()
    }

    pub async fn count_sub_sessions(&self, parent_id: &str) -> DomainErrorResult<u32> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sessions WHERE parent_session_id = ?"
        )
        .bind(parent_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_sqlx_err)?;
        Ok(row.0 as u32)
    }

    pub async fn find_main_sessions(&self, limit: u32, offset: u32) -> DomainErrorResult<Vec<Session>> {
        let rows: Vec<SessionRow> = sqlx::query_as(
            "SELECT * FROM sessions WHERE is_sub_session = FALSE ORDER BY started_at DESC LIMIT ? OFFSET ?"
        )
        .bind(limit as i32)
        .bind(offset as i32)
        .fetch_all(&self.pool)
        .await
        .map_err(map_sqlx_err)?;

        rows.into_iter().map(TryInto::try_into).collect()
    }
}

type DomainErrorResult<T> = Result<T, DomainError>;

fn map_sqlx_err(e: sqlx::Error) -> DomainError {
    DomainError::repository(format!("Database error: {}", e))
}