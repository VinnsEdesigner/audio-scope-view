#![allow(dead_code)]

use chrono::{DateTime, Utc};

#[derive(Debug, Clone, PartialEq)]
pub struct Session {
    pub id: String,
    pub user_id: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i64>,
    pub oscilloscope_opened_at: Option<DateTime<Utc>>,
    pub oscilloscope_duration_ms: Option<f64>,
    pub parent_session_id: Option<String>,
    pub is_sub_session: bool,
    pub peak_amplitude: Option<f32>,
    pub rms_amplitude: Option<f32>,
    pub dc_offset: Option<f32>,
    pub dominant_frequency: Option<f32>,
    pub frequency_high: Option<f32>,
    pub frequency_low: Option<f32>,
}

impl Session {
    pub fn new(id: String) -> Self {
        Self {
            id,
            user_id: None,
            name: None,
            description: None,
            started_at: Utc::now(),
            ended_at: None,
            duration_seconds: None,
            oscilloscope_opened_at: None,
            oscilloscope_duration_ms: None,
            parent_session_id: None,
            is_sub_session: false,
            peak_amplitude: None,
            rms_amplitude: None,
            dc_offset: None,
            dominant_frequency: None,
            frequency_high: None,
            frequency_low: None,
        }
    }

    pub fn new_named(id: String, name: Option<String>, description: Option<String>) -> Self {
        Self {
            id,
            user_id: None,
            name,
            description,
            started_at: Utc::now(),
            ended_at: None,
            duration_seconds: None,
            oscilloscope_opened_at: None,
            oscilloscope_duration_ms: None,
            parent_session_id: None,
            is_sub_session: false,
            peak_amplitude: None,
            rms_amplitude: None,
            dc_offset: None,
            dominant_frequency: None,
            frequency_high: None,
            frequency_low: None,
        }
    }

    pub fn new_sub_session(id: String, parent_id: String) -> Self {
        Self {
            id,
            user_id: None,
            name: None,
            description: None,
            started_at: Utc::now(),
            ended_at: None,
            duration_seconds: None,
            oscilloscope_opened_at: None,
            oscilloscope_duration_ms: None,
            parent_session_id: Some(parent_id),
            is_sub_session: true,
            peak_amplitude: None,
            rms_amplitude: None,
            dc_offset: None,
            dominant_frequency: None,
            frequency_high: None,
            frequency_low: None,
        }
    }

    pub fn with_user_id(mut self, user_id: String) -> Self {
        self.user_id = Some(user_id);
        self
    }

    pub fn with_name(mut self, name: String) -> Self {
        self.name = Some(name);
        self
    }

    pub fn with_description(mut self, description: String) -> Self {
        self.description = Some(description);
        self
    }

    pub fn end(&mut self) {
        let now = Utc::now();
        self.ended_at = Some(now);
        self.duration_seconds = Some((now - self.started_at).num_seconds());
    }

    pub fn is_active(&self) -> bool {
        self.ended_at.is_none()
    }

    pub fn is_sub_session(&self) -> bool {
        self.is_sub_session
    }

    pub fn parent_session_id(&self) -> Option<&str> {
        self.parent_session_id.as_deref()
    }

    pub fn open_oscilloscope(&mut self) {
        if self.oscilloscope_opened_at.is_none() {
            self.oscilloscope_opened_at = Some(Utc::now());
        }
    }

    pub fn close_oscilloscope(&mut self) {
        if let Some(opened_at) = self.oscilloscope_opened_at.take() {
            let now = Utc::now();
            let duration = (now - opened_at).num_milliseconds() as f64;
            self.oscilloscope_duration_ms = Some(
                self.oscilloscope_duration_ms.unwrap_or(0.0) + duration
            );
        }
    }

    pub fn is_oscilloscope_open(&self) -> bool {
        self.oscilloscope_opened_at.is_some()
    }

    pub fn display_name(&self) -> String {
        if let Some(ref name) = self.name {
            name.clone()
        } else if self.is_sub_session {
            let short_id = if self.id.len() > 8 { &self.id[self.id.len() - 8..] } else { &self.id };
            format!("Sub-session {}", short_id)
        } else {
            let short_id = if self.id.len() > 8 { &self.id[self.id.len() - 8..] } else { &self.id };
            format!("Session {}", short_id)
        }
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
        assert!(session.name.is_none());
        assert!(session.description.is_none());
        assert!(session.ended_at.is_none());
        assert!(session.is_active());
        assert!(!session.is_sub_session());
        assert!(session.parent_session_id.is_none());
    }

    #[test]
    fn test_new_named_session() {
        let session = Session::new_named(
            "session-1".to_string(),
            Some("Morning Lab".to_string()),
            Some("Testing audio filters".to_string()),
        );

        assert_eq!(session.id, "session-1");
        assert_eq!(session.name, Some("Morning Lab".to_string()));
        assert_eq!(session.description, Some("Testing audio filters".to_string()));
        assert!(!session.is_sub_session());
    }

    #[test]
    fn test_new_sub_session() {
        let session = Session::new_sub_session("sub-1".to_string(), "parent-1".to_string());

        assert_eq!(session.id, "sub-1");
        assert!(session.is_sub_session());
        assert_eq!(session.parent_session_id, Some("parent-1".to_string()));
        assert_eq!(session.display_name(), "Sub-session sub-1");
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

    #[test]
    fn test_display_name() {
        let short_id_session = Session::new("session1".to_string());
        assert_eq!(short_id_session.display_name(), "Session session1");

        let long_id_session = Session::new("session-12345678".to_string());
        assert_eq!(long_id_session.display_name(), "Session 12345678");

        let named_session = Session::new_named(
            "session-1".to_string(),
            Some("Custom Name".to_string()),
            None,
        );
        assert_eq!(named_session.display_name(), "Custom Name");
    }
}
