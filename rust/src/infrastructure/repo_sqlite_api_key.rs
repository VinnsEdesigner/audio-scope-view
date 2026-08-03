#![allow(dead_code)]
//! SQLite implementation of API Key persistence

use chrono::{DateTime, Utc};
use sqlx::{FromRow, SqlitePool};

use crate::api::auth::api_key::ApiKey;
use crate::shared::error_app::{AppError, AppResult};

/// Raw API key row from database
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

/// API key with hash for loading into memory store
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
            key: String::new(), // Key is not stored, only hash
            name: row.name,
            created_at: parse_datetime(&row.created_at)?,
            expires_at: row.expires_at.and_then(|s| parse_datetime(&s).ok()),
            rate_limit_per_minute: row.rate_limit_per_minute as u32,
            last_used_at: row.last_used_at.and_then(|s| parse_datetime(&s).ok()),
        })
    }
}

/// Parse datetime from SQLite string
fn parse_datetime(s: &str) -> AppResult<std::time::SystemTime> {
    // Try RFC3339 first
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Ok(dt.with_timezone(&Utc).into());
    }
    // Try SQLite default format
    if let Ok(ndt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S") {
        return Ok(ndt.and_utc().into());
    }
    // Try with nanoseconds
    if let Ok(dt) = DateTime::parse_from_rfc3339(&format!("{}Z", s)) {
        return Ok(dt.with_timezone(&Utc).into());
    }
    Err(AppError::validation(&format!("Invalid datetime format: {}", s)))
}

/// Format datetime to SQLite string
fn format_datetime(time: std::time::SystemTime) -> String {
    let datetime: DateTime<Utc> = time.into();
    datetime.to_rfc3339()
}

/// Hash a key for storage (same as in api_key.rs)
fn hash_key(key: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    key.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// SQLite repository for API keys
pub struct SqliteApiKeyRepository {
    pool: SqlitePool,
}

impl SqliteApiKeyRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Save a new API key to the database
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

    /// Update an existing API key
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

    /// Find an API key by its actual key
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

    /// Find an API key by ID (without the actual key)
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

    /// List all API keys (without the actual key)
    pub async fn list_all(&self) -> AppResult<Vec<ApiKey>> {
        let rows: Vec<ApiKeyRow> = sqlx::query_as(
            "SELECT * FROM api_keys ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::database(&format!("Failed to list API keys: {}", e)))?;

        rows.into_iter().map(TryInto::try_into).collect()
    }

    /// List all API keys with their hashes (for loading into memory store)
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
                    key: String::new(), // Key is not stored, only hash
                    name: row.name.clone(),
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

    /// Delete an API key by ID
    pub async fn delete(&self, id: &str) -> AppResult<bool> {
        let result = sqlx::query("DELETE FROM api_keys WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::database(&format!("Failed to delete API key: {}", e)))?;
        
        Ok(result.rows_affected() > 0)
    }

    /// Update the last_used_at timestamp
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

    /// Delete expired API keys
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
