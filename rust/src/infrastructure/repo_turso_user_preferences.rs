#![allow(dead_code)]

use crate::domain::entity_user_preferences::UserPreferences;
use crate::domain::error_domain::DomainError;
use crate::domain::trait_user_preferences_repository::{DomainResult, UserPreferencesRepository};
use crate::infrastructure::turso_http_client::{TursoArg, TursoClient, TursoResult};
use chrono::{DateTime, Utc};

pub struct TursoUserPreferencesRepository {
    client: TursoClient,
}

impl TursoUserPreferencesRepository {
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

    fn row_to_preferences(
        row: &[crate::infrastructure::turso_http_client::TursoValue],
    ) -> Result<UserPreferences, DomainError> {
        // Columns: id, user_id, last_used_session_id, auto_select_last_session,
        //          created_at, updated_at, auto_close_timeout_secs
        // Note: auto_close_timeout_secs was added via ALTER TABLE, so it appears
        // last in SELECT * output. Explicit column list in queries keeps order stable.
        let created_at_str = row
            .get(4)
            .and_then(|v| v.as_str())
            .ok_or_else(|| DomainError::corruption("Missing created_at".to_string()))?;
        let updated_at_str = row
            .get(5)
            .and_then(|v| v.as_str())
            .ok_or_else(|| DomainError::corruption("Missing updated_at".to_string()))?;

        Ok(UserPreferences {
            id: row
                .first()
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            user_id: row
                .get(1)
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(String::from),
            last_used_session_id: row
                .get(2)
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(String::from),
            auto_select_last_session: row.get(3).and_then(|v| v.as_bool()).unwrap_or(true),
            auto_close_timeout_secs: row.get(6).and_then(|v| v.as_i64()).map(|v| v as i32),
            created_at: Self::parse_datetime(created_at_str)?,
            updated_at: Self::parse_datetime(updated_at_str)?,
        })
    }
}

#[async_trait::async_trait]
impl UserPreferencesRepository for TursoUserPreferencesRepository {
    async fn get(&self, id: &str) -> DomainResult<Option<UserPreferences>> {
        let sql = "SELECT id, user_id, last_used_session_id, auto_select_last_session, created_at, updated_at, auto_close_timeout_secs FROM user_preferences WHERE id = ?";
        let result = self
            .client
            .execute_with_args(sql, vec![TursoArg::text(id)])
            .await
            .map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first()
            && let Some(row) = ok.response.result.rows.first()
        {
            return Ok(Some(Self::row_to_preferences(row)?));
        }
        Ok(None)
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
        let sql = r#"INSERT INTO user_preferences
            (id, user_id, last_used_session_id, auto_select_last_session, auto_close_timeout_secs, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                user_id = excluded.user_id,
                last_used_session_id = excluded.last_used_session_id,
                auto_select_last_session = excluded.auto_select_last_session,
                auto_close_timeout_secs = excluded.auto_close_timeout_secs,
                updated_at = excluded.updated_at"#;

        self.client
            .execute_void_with_args(
                sql,
                vec![
                    TursoArg::text(&preferences.id),
                    TursoArg::opt_text(preferences.user_id.clone()),
                    TursoArg::opt_text(preferences.last_used_session_id.clone()),
                    TursoArg::bool(preferences.auto_select_last_session),
                    preferences.auto_close_timeout_secs.into(),
                    TursoArg::text(preferences.created_at.to_rfc3339()),
                    TursoArg::text(preferences.updated_at.to_rfc3339()),
                ],
            )
            .await
            .map_err(Self::map_err)
    }

    async fn delete(&self, id: &str) -> DomainResult<bool> {
        let sql = "DELETE FROM user_preferences WHERE id = ?";
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
}
