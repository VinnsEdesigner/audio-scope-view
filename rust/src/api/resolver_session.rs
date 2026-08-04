#![allow(dead_code)]

use crate::domain::Session;

pub trait SessionResolver: Send + Sync {
    fn resolve_id<'a>(&self, session: &'a Session) -> &'a str {
        &session.id
    }
    fn resolve_started_at(&self, session: &Session) -> chrono::DateTime<chrono::Utc> {
        session.started_at
    }
    fn resolve_is_active(&self, session: &Session) -> bool {
        session.ended_at.is_none()
    }
}