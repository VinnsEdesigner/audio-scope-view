#![allow(dead_code)]

use chrono::{DateTime, Utc};
use sqlx::FromRow;
use sqlx::SqlitePool;

use crate::api::auth::api_key::ApiKey;
use crate::shared::error_app::{AppError, AppResult};
use crate::infrastructure::repo_trait_api_key::ApiKeyRepository;

#[derive(FromRow)]
struct ApiKeyRow {
    id: String,
    key_hash: String,
    name: String,
    rate_limit_per_minute: i32,
    expires_at: Option<String>,
    last_used_at: Option<String>,
    created_at: String,
}

#[derive(Debug, Clone)]
pub struct ApiKeyWithHash {
    pub api_key: ApiKey,
    pub key_hash: String,
}

impl TryFrom<ApiKeyRow> for ApiKey {
    type Error = AppError;

    fn try_from(row: ApiKeyRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.id,
            key: String::new(),             name: row.name,
            created_at: parse_datetime(&row.created_at)?,
            expires_at: row.expires_at.and_then(|s| parse_datetime(&s).ok()),
            rate_limit_per_minute: row.rate_limit_per_minute as u32,
            last_used_at: row.last_used_at.and_then(|s| parse_datetime(&s).ok()),
        })
    }
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
    Err(AppError::validation(&format!("Invalid datetime format: {}", s)))
}

fn format_datetime(time: std::time::SystemTime) -> String {
    let datetime: DateTime<Utc> = time.into();
    datetime.to_rfc3339()
}

fn hash_key(key: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    key.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

pub struct SqliteApiKeyRepository {
    pool: SqlitePool,
}

impl SqliteApiKeyRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn save(&self, api_key: &ApiKey) -> AppResult<()> {
        let key_hash = hash_key(&api_key.key);

        sqlx::query(
            r#"
            INSERT INTO api_keys (id, key_hash, name, rate_limit_per_minute, expires_at, last_used_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&api_key.id)
        .bind(&key_hash)
        .bind(&api_key.name)
        .bind(api_key.rate_limit_per_minute as i32)
        .bind(api_key.expires_at.map(format_datetime))
        .bind(api_key.last_used_at.map(format_datetime))
        .bind(format_datetime(api_key.created_at))
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::database(&format!("Failed to save API key: {}", e)))?;

        Ok(())
    }

    pub async fn update(&self, api_key: &ApiKey) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE api_keys
            SET name = ?, rate_limit_per_minute = ?, expires_at = ?, last_used_at = ?, updated_at = datetime('now')
            WHERE id = ?
            "#,
        )
        .bind(&api_key.name)
        .bind(api_key.rate_limit_per_minute as i32)
        .bind(api_key.expires_at.map(format_datetime))
        .bind(api_key.last_used_at.map(format_datetime))
        .bind(&api_key.id)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::database(&format!("Failed to update API key: {}", e)))?;

        Ok(())
    }

    pub async fn find_by_key(&self, key: &str) -> AppResult<Option<ApiKey>> {
        let key_hash = hash_key(key);

        let row: Option<ApiKeyRow> = sqlx::query_as(
            "SELECT * FROM api_keys WHERE key_hash = ?"
        )
        .bind(&key_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::database(&format!("Failed to find API key: {}", e)))?;

        match row {
            Some(r) => Ok(Some(r.try_into()?)),
            None => Ok(None),
        }
    }

    pub async fn find_by_id(&self, id: &str) -> AppResult<Option<ApiKey>> {
        let row: Option<ApiKeyRow> = sqlx::query_as(
            "SELECT * FROM api_keys WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::database(&format!("Failed to find API key: {}", e)))?;

        match row {
            Some(r) => Ok(Some(r.try_into()?)),
            None => Ok(None),
        }
    }

    pub async fn list_all(&self) -> AppResult<Vec<ApiKey>> {
        let rows: Vec<ApiKeyRow> = sqlx::query_as(
            "SELECT * FROM api_keys ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::database(&format!("Failed to list API keys: {}", e)))?;

        rows.into_iter().map(TryInto::try_into).collect()
    }

    pub async fn list_all_with_hash(&self) -> AppResult<Vec<ApiKeyWithHash>> {
        let rows: Vec<ApiKeyRow> = sqlx::query_as(
            "SELECT * FROM api_keys ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::database(&format!("Failed to list API keys: {}", e)))?;

        rows.into_iter()
            .map(|row| {
                let api_key = ApiKey {
                    id: row.id.clone(),
                    key: String::new(),                     name: row.name.clone(),
                    created_at: parse_datetime(&row.created_at)?,
                    expires_at: row.expires_at.and_then(|s| parse_datetime(&s).ok()),
                    rate_limit_per_minute: row.rate_limit_per_minute as u32,
                    last_used_at: row.last_used_at.and_then(|s| parse_datetime(&s).ok()),
                };
                Ok(ApiKeyWithHash {
                    api_key,
                    key_hash: row.key_hash,
                })
            })
            .collect()
    }

    pub async fn delete(&self, id: &str) -> AppResult<bool> {
        let result = sqlx::query("DELETE FROM api_keys WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::database(&format!("Failed to delete API key: {}", e)))?;

        Ok(result.rows_affected() > 0)
    }

    pub async fn update_last_used(&self, id: &str) -> AppResult<()> {
        sqlx::query(
            "UPDATE api_keys SET last_used_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
        )
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::database(&format!("Failed to update last_used_at: {}", e)))?;

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn delete_expired(&self) -> AppResult<u64> {
        let result = sqlx::query(
            "DELETE FROM api_keys WHERE expires_at IS NOT NULL AND expires_at < datetime('now')"
        )
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::database(&format!("Failed to delete expired API keys: {}", e)))?;

        Ok(result.rows_affected())
    }
}

#[async_trait::async_trait]
impl ApiKeyRepository for SqliteApiKeyRepository {
    async fn save(&self, api_key: &ApiKey) -> AppResult<()> {
        SqliteApiKeyRepository::save(self, api_key).await
    }

    async fn update(&self, api_key: &ApiKey) -> AppResult<()> {
        SqliteApiKeyRepository::update(self, api_key).await
    }

    async fn find_by_key(&self, key: &str) -> AppResult<Option<ApiKey>> {
        SqliteApiKeyRepository::find_by_key(self, key).await
    }

    async fn find_by_id(&self, id: &str) -> AppResult<Option<ApiKey>> {
        SqliteApiKeyRepository::find_by_id(self, id).await
    }

    async fn list_all(&self) -> AppResult<Vec<ApiKey>> {
        SqliteApiKeyRepository::list_all(self).await
    }

    async fn list_all_with_hash(&self) -> AppResult<Vec<ApiKeyWithHash>> {
        SqliteApiKeyRepository::list_all_with_hash(self).await
    }

    async fn delete(&self, id: &str) -> AppResult<bool> {
        SqliteApiKeyRepository::delete(self, id).await
    }

    async fn update_last_used(&self, id: &str) -> AppResult<()> {
        SqliteApiKeyRepository::update_last_used(self, id).await
    }
}