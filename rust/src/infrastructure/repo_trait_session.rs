#![allow(dead_code)]

//! Repository trait for session storage
//! This trait is implemented by both SQLite and Turso repositories

use crate::domain::Session;
use crate::domain::error_domain::DomainError;

pub type DomainErrorResult<T> = Result<T, DomainError>;

/// Trait for session repository operations
/// Both SQLite and Turso implementations must implement this trait
///
/// `device_id` scopes queries to a single device. When `None`, the query is
/// unscoped (admin/system view). This is the data-isolation boundary: sessions
/// created by one device are only returned to that device.
#[async_trait::async_trait]
pub trait SessionRepository: Send + Sync {
    async fn save_session(&self, session: &Session) -> DomainErrorResult<()>;
    async fn update_session(&self, session: &Session) -> DomainErrorResult<()>;
    async fn find_by_id(&self, id: &str) -> DomainErrorResult<Option<Session>>;
    async fn find_active_session(&self, device_id: Option<&str>) -> DomainErrorResult<Option<Session>>;
    async fn find_all_sessions(&self, device_id: Option<&str>, limit: u32, offset: u32) -> DomainErrorResult<Vec<Session>>;
    async fn delete(&self, id: &str) -> DomainErrorResult<bool>;
    async fn count_sessions(&self, device_id: Option<&str>) -> DomainErrorResult<u32>;
    async fn find_sub_sessions(&self, parent_id: &str) -> DomainErrorResult<Vec<Session>>;
    async fn find_sub_sessions_paginated(&self, parent_id: &str, limit: u32, offset: u32) -> DomainErrorResult<Vec<Session>>;
    async fn count_sub_sessions(&self, parent_id: &str) -> DomainErrorResult<u32>;
    async fn find_main_sessions(&self, device_id: Option<&str>, limit: u32, offset: u32) -> DomainErrorResult<Vec<Session>>;
}
