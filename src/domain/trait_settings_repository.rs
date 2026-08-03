
#![allow(dead_code)]
use crate::domain::{DomainResult, Settings};

#[allow(async_fn_in_trait)]
pub trait SettingsRepository: Send + Sync {
    async fn save(&self, settings: &Settings) -> DomainResult<()>;

    async fn update(&self, settings: &Settings) -> DomainResult<()>;

    async fn find_by_id(&self, id: &str) -> DomainResult<Option<Settings>>;

    async fn find_by_session_id(&self, session_id: &str) -> DomainResult<Option<Settings>>;

    async fn delete(&self, id: &str) -> DomainResult<bool>;

    async fn delete_by_session_id(&self, session_id: &str) -> DomainResult<bool>;
}
