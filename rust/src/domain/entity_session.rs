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
    /// When oscilloscope was opened within this session
    pub oscilloscope_opened_at: Option<DateTime<Utc>>,
    /// Total oscilloscope capture duration in milliseconds
    pub oscilloscope_duration_ms: Option<f64>,
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
            oscilloscope_opened_at: None,
            oscilloscope_duration_ms: None,
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

    /// Open oscilloscope capture (starts tracking time)
    pub fn open_oscilloscope(&mut self) {
        if self.oscilloscope_opened_at.is_none() {
            self.oscilloscope_opened_at = Some(Utc::now());
        }
    }

    /// Close oscilloscope capture (calculates duration)
    pub fn close_oscilloscope(&mut self) {
        if let Some(opened_at) = self.oscilloscope_opened_at.take() {
            let now = Utc::now();
            let duration = (now - opened_at).num_milliseconds() as f64;
            self.oscilloscope_duration_ms = Some(
                self.oscilloscope_duration_ms.unwrap_or(0.0) + duration
            );
        }
    }

    /// Check if oscilloscope is currently open
    pub fn is_oscilloscope_open(&self) -> bool {
        self.oscilloscope_opened_at.is_some()
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
