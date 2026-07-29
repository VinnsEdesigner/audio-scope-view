//! Session repository trait

#![allow(dead_code)]
use crate::domain::{DomainResult, Session};

/// Repository trait for Session entities
#[async_trait::async_trait]
#[allow(async_fn_in_trait)]
pub trait SessionRepository: Send + Sync {
    /// Save a session
    async fn save_session(&self, session: &Session) -> DomainResult<()>;

    /// Update a session
    async fn update_session(&self, session: &Session) -> DomainResult<()>;

    /// Find a session by ID
    async fn find_by_id(&self, id: &str) -> DomainResult<Option<Session>>;

    /// Find all sessions with pagination
    async fn find_all_sessions(&self, limit: u32, offset: u32) -> DomainResult<Vec<Session>>;

    /// Count total sessions
    async fn count_sessions(&self) -> DomainResult<u32>;

    /// Delete a session
    async fn delete(&self, id: &str) -> DomainResult<bool>;
}
