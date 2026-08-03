#![allow(dead_code)]
//! Trait for UserPreferences repository

use crate::domain::entity_user_preferences::UserPreferences;
use crate::domain::error_domain::DomainError;

/// Result type for domain operations
pub type DomainResult<T> = Result<T, DomainError>;

/// Repository trait for UserPreferences
#[async_trait::async_trait]
#[allow(async_fn_in_trait)]
pub trait UserPreferencesRepository: Send + Sync {
    /// Get user preferences by ID
    async fn get(&self, id: &str) -> DomainResult<Option<UserPreferences>>;
    
    /// Get or create default user preferences
    async fn get_or_create(&self, id: &str) -> DomainResult<UserPreferences>;
    
    /// Save (create or update) user preferences
    async fn save(&self, preferences: &UserPreferences) -> DomainResult<()>;
    
    /// Delete user preferences
    async fn delete(&self, id: &str) -> DomainResult<bool>;
}
