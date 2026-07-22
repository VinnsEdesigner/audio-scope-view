#![allow(dead_code)]
//! SQLite implementation of ScopeRepository

use crate::domain::{Scope, error_domain::DomainError};
use chrono::{DateTime, Utc};
use sqlx::{FromRow, SqlitePool};

/// Raw scope row from database
#[derive(FromRow)]
struct ScopeRow {
    id: String,
    name: String,
    description: Option<String>,
    sample_rate: i32,
    buffer_size: i32,
    is_active: i32,
    created_at: String,
    updated_at: String,
}

impl TryFrom<ScopeRow> for Scope {
    type Error = DomainError;

    fn try_from(row: ScopeRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.id,
            name: row.name,
            description: row.description,
            sample_rate: row.sample_rate as u32,
            buffer_size: row.buffer_size as u32,
            is_active: row.is_active != 0,
            created_at: parse_datetime(&row.created_at)?,
            updated_at: parse_datetime(&row.updated_at)?,
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

/// SQLite implementation of ScopeRepository
pub struct SqliteScopeRepository {
    pool: SqlitePool,
}

impl SqliteScopeRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    async fn to_row(scope: &Scope) -> ScopeRow {
        ScopeRow {
            id: scope.id.clone(),
            name: scope.name.clone(),
            description: scope.description.clone(),
            sample_rate: scope.sample_rate as i32,
            buffer_size: scope.buffer_size as i32,
            is_active: if scope.is_active { 1 } else { 0 },
            created_at: scope.created_at.to_rfc3339(),
            updated_at: scope.updated_at.to_rfc3339(),
        }
    }
}

impl SqliteScopeRepository {
    pub async fn save(&self, scope: &Scope) -> DomainErrorResult<()> {
        let row = Self::to_row(scope).await;
        sqlx::query(
            r#"
            INSERT INTO scopes (id, name, description, sample_rate, buffer_size, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&row.id)
        .bind(&row.name)
        .bind(&row.description)
        .bind(row.sample_rate)
        .bind(row.buffer_size)
        .bind(row.is_active)
        .bind(&row.created_at)
        .bind(&row.updated_at)
        .execute(&self.pool)
        .await
        .map_err(map_sqlx_err)?;
        Ok(())
    }

    pub async fn update(&self, scope: &Scope) -> DomainErrorResult<()> {
        let row = Self::to_row(scope).await;
        sqlx::query(
            r#"
            UPDATE scopes
            SET name = ?, description = ?, sample_rate = ?, buffer_size = ?, is_active = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&row.name)
        .bind(&row.description)
        .bind(row.sample_rate)
        .bind(row.buffer_size)
        .bind(row.is_active)
        .bind(&row.updated_at)
        .bind(&row.id)
        .execute(&self.pool)
        .await
        .map_err(map_sqlx_err)?;
        Ok(())
    }

    pub async fn find_by_id(&self, id: &str) -> DomainErrorResult<Option<Scope>> {
        let row: Option<ScopeRow> = sqlx::query_as("SELECT * FROM scopes WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_sqlx_err)?;

        match row {
            Some(r) => Ok(Some(r.try_into()?)),
            None => Ok(None),
        }
    }

    pub async fn find_all(&self, limit: u32, offset: u32) -> DomainErrorResult<Vec<Scope>> {
        let rows: Vec<ScopeRow> =
            sqlx::query_as("SELECT * FROM scopes ORDER BY created_at DESC LIMIT ? OFFSET ?")
                .bind(limit as i32)
                .bind(offset as i32)
                .fetch_all(&self.pool)
                .await
                .map_err(map_sqlx_err)?;

        rows.into_iter().map(TryInto::try_into).collect()
    }

    pub async fn find_active(&self) -> DomainErrorResult<Vec<Scope>> {
        let rows: Vec<ScopeRow> =
            sqlx::query_as("SELECT * FROM scopes WHERE is_active = 1 ORDER BY created_at DESC")
                .fetch_all(&self.pool)
                .await
                .map_err(map_sqlx_err)?;

        rows.into_iter().map(TryInto::try_into).collect()
    }

    pub async fn delete(&self, id: &str) -> DomainErrorResult<bool> {
        let result = sqlx::query("DELETE FROM scopes WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_sqlx_err)?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn count(&self) -> DomainErrorResult<u32> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM scopes")
            .fetch_one(&self.pool)
            .await
            .map_err(map_sqlx_err)?;
        Ok(row.0 as u32)
    }

    pub async fn count_active(&self) -> DomainErrorResult<u32> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM scopes WHERE is_active = 1")
            .fetch_one(&self.pool)
            .await
            .map_err(map_sqlx_err)?;
        Ok(row.0 as u32)
    }
}

type DomainErrorResult<T> = Result<T, DomainError>;

fn map_sqlx_err(e: sqlx::Error) -> DomainError {
    DomainError::repository(format!("Database error: {}", e))
}
