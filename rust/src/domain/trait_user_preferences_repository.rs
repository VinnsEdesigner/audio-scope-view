#![allow(dead_code)]

use crate::domain::entity_user_preferences::UserPreferences;
use crate::domain::error_domain::DomainError;

pub type DomainResult<T> = Result<T, DomainError>;

#[async_trait::async_trait]
#[allow(async_fn_in_trait)]
pub trait UserPreferencesRepository: Send + Sync {
    async fn get(&self, id: &str) -> DomainResult<Option<UserPreferences>>;

    async fn get_or_create(&self, id: &str) -> DomainResult<UserPreferences>;

    async fn save(&self, preferences: &UserPreferences) -> DomainResult<()>;

    async fn delete(&self, id: &str) -> DomainResult<bool>;
}
