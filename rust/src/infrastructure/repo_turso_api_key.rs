#![allow(dead_code)]

use crate::api::auth::api_key::ApiKey;
use crate::infrastructure::repo_sqlite_api_key::ApiKeyWithHash;
use crate::infrastructure::repo_trait_api_key::ApiKeyRepository;
use crate::infrastructure::turso_http_client::{TursoArg, TursoClient, TursoResult};
use crate::shared::error_app::AppResult;
use chrono::{DateTime, Utc};

pub struct TursoApiKeyRepository {
    client: TursoClient,
}

impl TursoApiKeyRepository {
    pub fn new(client: TursoClient) -> Self {
        Self { client }
    }

    fn map_err(e: crate::shared::error_app::AppError) -> crate::shared::error_app::AppError {
        crate::shared::error_app::AppError::database(&format!("Database error: {}", e))
    }

    fn hash_key(key: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        key.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    fn format_datetime(time: std::time::SystemTime) -> String {
        let datetime: DateTime<Utc> = time.into();
        datetime.to_rfc3339()
    }

    fn parse_datetime(s: &str) -> AppResult<std::time::SystemTime> {
        if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
            return Ok(dt.with_timezone(&Utc).into());
        }
        if let Ok(ndt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S") {
            return Ok(ndt.and_utc().into());
        }
        if let Ok(dt) = DateTime::parse_from_rfc3339(&format!("{}Z", s)) {
            return Ok(dt.with_timezone(&Utc).into());
        }
        Err(crate::shared::error_app::AppError::validation(&format!(
            "Invalid datetime format: {}",
            s
        )))
    }

    fn row_to_api_key(
        row: &[crate::infrastructure::turso_http_client::TursoValue],
    ) -> AppResult<ApiKey> {
        // Columns: id, key_hash, name, rate_limit_per_minute, expires_at, last_used_at, created_at
        let created_at_str = row
            .get(6)
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::shared::error_app::AppError::database("Missing created_at"))?;
        Ok(ApiKey {
            id: row
                .first()
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            key: String::new(),
            name: row
                .get(2)
                .and_then(|v| v.as_str())
                .ok_or_else(|| crate::shared::error_app::AppError::database("Missing name"))?
                .to_string(),
            created_at: Self::parse_datetime(created_at_str)?,
            expires_at: row
                .get(4)
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .and_then(|s| Self::parse_datetime(s).ok()),
            rate_limit_per_minute: row.get(3).and_then(|v| v.as_i64()).unwrap_or(60) as u32,
            last_used_at: row
                .get(5)
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .and_then(|s| Self::parse_datetime(s).ok()),
        })
    }
}

#[async_trait::async_trait]
impl ApiKeyRepository for TursoApiKeyRepository {
    async fn save(&self, api_key: &ApiKey) -> AppResult<()> {
        let key_hash = Self::hash_key(&api_key.key);
        let sql = r#"INSERT INTO api_keys (id, key_hash, name, rate_limit_per_minute, expires_at, last_used_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)"#;

        self.client
            .execute_void_with_args(
                sql,
                vec![
                    TursoArg::text(&api_key.id),
                    TursoArg::text(key_hash),
                    TursoArg::text(&api_key.name),
                    (api_key.rate_limit_per_minute as i32).into(),
                    TursoArg::opt_text(api_key.expires_at.map(Self::format_datetime)),
                    TursoArg::opt_text(api_key.last_used_at.map(Self::format_datetime)),
                    TursoArg::text(Self::format_datetime(api_key.created_at)),
                ],
            )
            .await
            .map_err(Self::map_err)
    }

    async fn update(&self, api_key: &ApiKey) -> AppResult<()> {
        let now = Utc::now().to_rfc3339();
        let sql = r#"UPDATE api_keys
            SET name = ?, rate_limit_per_minute = ?, expires_at = ?, last_used_at = ?, updated_at = ?
            WHERE id = ?"#;

        self.client
            .execute_void_with_args(
                sql,
                vec![
                    TursoArg::text(&api_key.name),
                    (api_key.rate_limit_per_minute as i32).into(),
                    TursoArg::opt_text(api_key.expires_at.map(Self::format_datetime)),
                    TursoArg::opt_text(api_key.last_used_at.map(Self::format_datetime)),
                    TursoArg::text(now),
                    TursoArg::text(&api_key.id),
                ],
            )
            .await
            .map_err(Self::map_err)
    }

    async fn find_by_key(&self, key: &str) -> AppResult<Option<ApiKey>> {
        let key_hash = Self::hash_key(key);
        let sql = "SELECT * FROM api_keys WHERE key_hash = ?";
        let result = self
            .client
            .execute_with_args(sql, vec![TursoArg::text(key_hash)])
            .await
            .map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first()
            && let Some(row) = ok.response.result.rows.first()
        {
            return Ok(Some(Self::row_to_api_key(row)?));
        }
        Ok(None)
    }

    async fn find_by_id(&self, id: &str) -> AppResult<Option<ApiKey>> {
        let sql = "SELECT * FROM api_keys WHERE id = ?";
        let result = self
            .client
            .execute_with_args(sql, vec![TursoArg::text(id)])
            .await
            .map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first()
            && let Some(row) = ok.response.result.rows.first()
        {
            return Ok(Some(Self::row_to_api_key(row)?));
        }
        Ok(None)
    }

    async fn list_all(&self) -> AppResult<Vec<ApiKey>> {
        let sql = "SELECT * FROM api_keys ORDER BY created_at DESC";
        let result = self.client.execute(sql).await.map_err(Self::map_err)?;
        let mut keys = Vec::new();
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            for row in &ok.response.result.rows {
                keys.push(Self::row_to_api_key(row)?);
            }
        }
        Ok(keys)
    }

    async fn list_all_with_hash(&self) -> AppResult<Vec<ApiKeyWithHash>> {
        let sql = "SELECT * FROM api_keys ORDER BY created_at DESC";
        let result = self.client.execute(sql).await.map_err(Self::map_err)?;
        let mut keys_with_hash = Vec::new();
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            for row in &ok.response.result.rows {
                let api_key = Self::row_to_api_key(row)?;
                let key_hash = row
                    .get(1)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                keys_with_hash.push(ApiKeyWithHash { api_key, key_hash });
            }
        }
        Ok(keys_with_hash)
    }

    async fn delete(&self, id: &str) -> AppResult<bool> {
        let sql = "DELETE FROM api_keys WHERE id = ?";
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

    async fn update_last_used(&self, id: &str) -> AppResult<()> {
        let now = Utc::now().to_rfc3339();
        let sql = "UPDATE api_keys SET last_used_at = ?, updated_at = ? WHERE id = ?";
        self.client
            .execute_void_with_args(
                sql,
                vec![
                    TursoArg::text(now.clone()),
                    TursoArg::text(now),
                    TursoArg::text(id),
                ],
            )
            .await
            .map_err(Self::map_err)
    }
}
