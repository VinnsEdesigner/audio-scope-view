
#![allow(dead_code)]
use crate::domain::{DomainResult, Session};

#[async_trait::async_trait]
#[allow(async_fn_in_trait)]
pub trait SessionRepository: Send + Sync {
    async fn save_session(&self, session: &Session) -> DomainResult<()>;

    async fn update_session(&self, session: &Session) -> DomainResult<()>;

    async fn find_by_id(&self, id: &str) -> DomainResult<Option<Session>>;

    async fn find_all_sessions(&self, limit: u32, offset: u32) -> DomainResult<Vec<Session>>;

    async fn count_sessions(&self) -> DomainResult<u32>;

    async fn delete(&self, id: &str) -> DomainResult<bool>;
}