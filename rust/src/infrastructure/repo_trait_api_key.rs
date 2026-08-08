#![allow(dead_code)]

//! Repository trait for API key storage.
//! Implemented by both SQLite and Turso repositories.

use crate::api::auth::api_key::ApiKey;
use crate::shared::error_app::AppResult;

use crate::infrastructure::repo_sqlite_api_key::ApiKeyWithHash;

#[async_trait::async_trait]
pub trait ApiKeyRepository: Send + Sync {
    async fn save(&self, api_key: &ApiKey) -> AppResult<()>;
    async fn update(&self, api_key: &ApiKey) -> AppResult<()>;
    async fn find_by_key(&self, key: &str) -> AppResult<Option<ApiKey>>;
    async fn find_by_id(&self, id: &str) -> AppResult<Option<ApiKey>>;
    async fn list_all(&self) -> AppResult<Vec<ApiKey>>;
    async fn list_all_with_hash(&self) -> AppResult<Vec<ApiKeyWithHash>>;
    async fn delete(&self, id: &str) -> AppResult<bool>;
    async fn update_last_used(&self, id: &str) -> AppResult<()>;
}
