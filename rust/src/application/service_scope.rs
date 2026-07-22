#![allow(dead_code)]
//! Scope service - Business logic for scope operations

use crate::domain::Scope;
use crate::infrastructure::repo_sqlite_scope::SqliteScopeRepository;
use crate::shared::{AppError, AppResult};
use std::sync::Arc;

/// Scope service for managing audio scopes
pub struct ScopeService {
    repository: Arc<SqliteScopeRepository>,
}

impl ScopeService {
    pub fn new(repository: Arc<SqliteScopeRepository>) -> Self {
        Self { repository }
    }

    /// Create a new scope
    pub async fn create(&self, name: String) -> AppResult<Scope> {
        let scope = Scope::new(uuid::Uuid::new_v4().to_string(), name);
        self.repository
            .save(&scope)
            .await
            .map_err(AppError::Domain)?;
        Ok(scope)
    }

    /// Get a scope by ID
    pub async fn get(&self, id: &str) -> AppResult<Option<Scope>> {
        self.repository
            .find_by_id(id)
            .await
            .map_err(AppError::Domain)
    }

    /// List all scopes with pagination
    pub async fn list(&self, limit: u32, offset: u32) -> AppResult<Vec<Scope>> {
        self.repository
            .find_all(limit, offset)
            .await
            .map_err(AppError::Domain)
    }

    /// Get all active scopes
    pub async fn get_active(&self) -> AppResult<Vec<Scope>> {
        self.repository
            .find_active()
            .await
            .map_err(AppError::Domain)
    }

    /// Update a scope
    pub async fn update(&self, scope: Scope) -> AppResult<()> {
        self.repository
            .update(&scope)
            .await
            .map_err(AppError::Domain)
    }

    /// Delete a scope
    pub async fn delete(&self, id: &str) -> AppResult<bool> {
        self.repository.delete(id).await.map_err(AppError::Domain)
    }

    /// Count total scopes
    pub async fn count(&self) -> AppResult<u32> {
        self.repository.count().await.map_err(AppError::Domain)
    }

    /// Count active scopes
    pub async fn count_active(&self) -> AppResult<u32> {
        self.repository
            .count_active()
            .await
            .map_err(AppError::Domain)
    }
}
