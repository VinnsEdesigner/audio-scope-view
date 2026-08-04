#![allow(dead_code)]

use chrono::{DateTime, Utc};
use sqlx::{FromRow, SqlitePool};

use crate::domain::{
    error_domain::DomainError,
    entity_user_preferences::UserPreferences,
    trait_user_preferences_repository::{UserPreferencesRepository, DomainResult},
};

#[derive(FromRow)]
struct UserPreferencesRow {
    id: String,
    user_id: Option<String>,
    last_used_session_id: Option<String>,
    auto_select_last_session: i32,
    auto_close_timeout_secs: Option<i32>,
    created_at: String,
    updated_at: String,
}

fn parse_datetime(s: &str) -> Result<DateTime<Utc>, DomainError> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .or_else(|_| {
            chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").map(|ndt| ndt.and_utc())
        })
        .map_err(|_| DomainError::corruption(format!("Invalid datetime format: {}", s)))
}

impl TryFrom<UserPreferencesRow> for UserPreferences {
    type Error = DomainError;

    fn try_from(row: UserPreferencesRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.id,
            user_id: row.user_id,
            last_used_session_id: row.last_used_session_id,
            auto_select_last_session: row.auto_select_last_session != 0,
            auto_close_timeout_secs: row.auto_close_timeout_secs,
            created_at: parse_datetime(&row.created_at)?,
            updated_at: parse_datetime(&row.updated_at)?,
        })
    }
}

pub struct SqliteUserPreferencesRepository {
    pool: SqlitePool,
}

impl SqliteUserPreferencesRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl UserPreferencesRepository for SqliteUserPreferencesRepository {
    async fn get(&self, id: &str) -> DomainResult<Option<UserPreferences>> {
        let row: Option<UserPreferencesRow> = sqlx::query_as(
            "SELECT * FROM user_preferences WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::repository(format!("Database error: {}", e)))?;

        match row {
            Some(r) => Ok(Some(r.try_into()?)),
            None => Ok(None),
        }
    }

    async fn get_or_create(&self, id: &str) -> DomainResult<UserPreferences> {
        if let Some(existing) = self.get(id).await? {
            return Ok(existing);
        }

        let new_prefs = UserPreferences::new(id.to_string());
        self.save(&new_prefs).await?;
        Ok(new_prefs)
    }

    async fn save(&self, preferences: &UserPreferences) -> DomainResult<()> {
        sqlx::query(
            r#"
            INSERT INTO user_preferences (id, user_id, last_used_session_id, auto_select_last_session, auto_close_timeout_secs, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                user_id = excluded.user_id,
                last_used_session_id = excluded.last_used_session_id,
                auto_select_last_session = excluded.auto_select_last_session,
                auto_close_timeout_secs = excluded.auto_close_timeout_secs,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(&preferences.id)
        .bind(&preferences.user_id)
        .bind(&preferences.last_used_session_id)
        .bind(if preferences.auto_select_last_session { 1 } else { 0 })
        .bind(preferences.auto_close_timeout_secs)
        .bind(preferences.created_at.to_rfc3339())
        .bind(preferences.updated_at.to_rfc3339())
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::repository(format!("Database error: {}", e)))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> DomainResult<bool> {
        let result = sqlx::query("DELETE FROM user_preferences WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::repository(format!("Database error: {}", e)))?;
        Ok(result.rows_affected() > 0)
    }
}