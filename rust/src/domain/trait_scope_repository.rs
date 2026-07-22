//! Scope repository trait

#![allow(dead_code)]
use crate::domain::{DomainResult, Scope};

/// Repository trait for Scope entities
#[async_trait::async_trait]
#[allow(async_fn_in_trait)]
pub trait ScopeRepository: Send + Sync {
    /// Save a scope
    async fn save(&self, scope: &Scope) -> DomainResult<()>;

    /// Update a scope
    async fn update(&self, scope: &Scope) -> DomainResult<()>;

    /// Find a scope by ID
    async fn find_by_id(&self, id: &str) -> DomainResult<Option<Scope>>;

    /// Find all scopes with pagination
    async fn find_all(&self, limit: u32, offset: u32) -> DomainResult<Vec<Scope>>;

    /// Find active scopes
    async fn find_active(&self) -> DomainResult<Vec<Scope>>;

    /// Count total scopes
    async fn count(&self) -> DomainResult<u32>;

    /// Count active scopes
    async fn count_active(&self) -> DomainResult<u32>;

    /// Delete a scope
    async fn delete(&self, id: &str) -> DomainResult<bool>;
}
