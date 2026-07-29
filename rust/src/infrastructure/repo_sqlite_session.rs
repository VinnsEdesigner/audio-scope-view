#![allow(dead_code)]
//! SQLite implementation of SessionRepository

use crate::domain::{Session, error_domain::DomainError};
use chrono::{DateTime, Utc};
use sqlx::{FromRow, SqlitePool};

/// Raw session row from database
#[derive(FromRow)]
struct SessionRow {
    id: String,
    user_id: Option<String>,
    started_at: String,
    ended_at: Option<String>,
    duration_seconds: Option<i64>,
}

impl TryFrom<SessionRow> for Session {
    type Error = DomainError;

    fn try_from(row: SessionRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.id,
            user_id: row.user_id,
            started_at: parse_datetime(&row.started_at)?,
            ended_at: row.ended_at.and_then(|s| parse_datetime(&s).ok()),
            duration_seconds: row.duration_seconds,
        })
    }
}

/// Parse datetime from SQLite string
fn parse_datetime(s: &str) -> Result<DateTime<Utc>, DomainError> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .or_else(|_| {
            // Try SQLite default format
            chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").map(|ndt| ndt.and_utc())
        })
        .map_err(|_| DomainError::corruption(format!("Invalid datetime format: {}", s)))
}

/// SQLite implementation of SessionRepository
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
            INSERT INTO sessions (id, user_id, started_at, ended_at, duration_seconds)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(&session.id)
        .bind(&session.user_id)
        .bind(session.started_at.to_rfc3339())
        .bind(session.ended_at.map(|dt| dt.to_rfc3339()))
        .bind(session.duration_seconds)
        .execute(&self.pool)
        .await
        .map_err(map_sqlx_err)?;
        Ok(())
    }

    pub async fn update_session(&self, session: &Session) -> DomainErrorResult<()> {
        sqlx::query(
            r#"
            UPDATE sessions
            SET user_id = ?, started_at = ?, ended_at = ?, duration_seconds = ?
            WHERE id = ?
            "#,
        )
        .bind(&session.user_id)
        .bind(session.started_at.to_rfc3339())
        .bind(session.ended_at.map(|dt| dt.to_rfc3339()))
        .bind(session.duration_seconds)
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
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sessions")
            .fetch_one(&self.pool)
            .await
            .map_err(map_sqlx_err)?;
        Ok(row.0 as u32)
    }

    pub async fn count(&self) -> DomainErrorResult<u32> {
        self.count_sessions().await
    }
}

type DomainErrorResult<T> = Result<T, DomainError>;

fn map_sqlx_err(e: sqlx::Error) -> DomainError {
    DomainError::repository(format!("Database error: {}", e))
}
