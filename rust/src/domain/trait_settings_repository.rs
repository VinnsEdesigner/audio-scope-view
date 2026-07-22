//! Settings repository trait

#![allow(dead_code)]
use crate::domain::{DomainResult, Settings};

/// Repository trait for Settings entities
#[allow(async_fn_in_trait)]
pub trait SettingsRepository: Send + Sync {
    /// Save settings
    async fn save(&self, settings: &Settings) -> DomainResult<()>;

    /// Update settings
    async fn update(&self, settings: &Settings) -> DomainResult<()>;

    /// Find settings by ID
    async fn find_by_id(&self, id: &str) -> DomainResult<Option<Settings>>;

    /// Find settings by scope ID
    async fn find_by_scope_id(&self, scope_id: &str) -> DomainResult<Option<Settings>>;

    /// Delete settings by ID
    async fn delete(&self, id: &str) -> DomainResult<bool>;

    /// Delete settings by scope ID
    async fn delete_by_scope_id(&self, scope_id: &str) -> DomainResult<bool>;
}
