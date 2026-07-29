#![allow(dead_code)]
//! Session entity - Ephemeral record of a live canvas instance

use chrono::{DateTime, Utc};

/// Session entity representing an ephemeral oscilloscope canvas instance
/// Sessions are auto-created when canvas opens and auto-saved after ~1 minute
#[derive(Debug, Clone, PartialEq)]
pub struct Session {
    pub id: String,
    pub user_id: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i64>,
}

impl Session {
    /// Create a new Session
    pub fn new(id: String) -> Self {
        Self {
            id,
            user_id: None,
            started_at: Utc::now(),
            ended_at: None,
            duration_seconds: None,
        }
    }

    /// Set the user ID
    pub fn with_user_id(mut self, user_id: String) -> Self {
        self.user_id = Some(user_id);
        self
    }

    /// End the session and calculate duration
    pub fn end(&mut self) {
        let now = Utc::now();
        self.ended_at = Some(now);
        self.duration_seconds = Some((now - self.started_at).num_seconds());
    }

    /// Check if session is still active (not ended)
    pub fn is_active(&self) -> bool {
        self.ended_at.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_session() {
        let session = Session::new("session-1".to_string());

        assert_eq!(session.id, "session-1");
        assert!(session.user_id.is_none());
        assert!(session.ended_at.is_none());
        assert!(session.is_active());
    }

    #[test]
    fn test_end_session() {
        let mut session = Session::new("session-1".to_string());
        assert!(session.is_active());

        session.end();

        assert!(!session.is_active());
        assert!(session.ended_at.is_some());
        assert!(session.duration_seconds.is_some());
    }
}
