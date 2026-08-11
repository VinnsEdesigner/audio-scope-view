#![allow(dead_code)]

use chrono::{DateTime, Utc};

#[derive(Debug, Clone)]
pub struct UserPreferences {
    pub id: String,
    pub user_id: Option<String>,
    pub last_used_session_id: Option<String>,
    pub auto_select_last_session: bool,
    pub auto_close_timeout_secs: Option<i32>, // None = no timeout, Some(n) = timeout in seconds
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl UserPreferences {
    pub fn new(id: String) -> Self {
        let now = Utc::now();
        Self {
            id,
            user_id: None,
            last_used_session_id: None,
            auto_select_last_session: true,
            auto_close_timeout_secs: Some(300), // Default 5 minutes
            created_at: now,
            updated_at: now,
        }
    }

    pub fn with_last_used_session(mut self, session_id: Option<String>) -> Self {
        self.last_used_session_id = session_id;
        self.updated_at = Utc::now();
        self
    }

    pub fn with_auto_select(mut self, auto_select: bool) -> Self {
        self.auto_select_last_session = auto_select;
        self.updated_at = Utc::now();
        self
    }

    pub fn update_last_used_session(&mut self, session_id: Option<String>) {
        self.last_used_session_id = session_id;
        self.updated_at = Utc::now();
    }

    pub fn update_auto_select(&mut self, auto_select: bool) {
        self.auto_select_last_session = auto_select;
        self.updated_at = Utc::now();
    }

    pub fn update_auto_close_timeout(&mut self, timeout_secs: Option<i32>) {
        self.auto_close_timeout_secs = timeout_secs;
        self.updated_at = Utc::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_user_preferences() {
        let prefs = UserPreferences::new("prefs-1".to_string());

        assert_eq!(prefs.id, "prefs-1");
        assert!(prefs.user_id.is_none());
        assert!(prefs.last_used_session_id.is_none());
        assert!(prefs.auto_select_last_session);
        assert_eq!(prefs.auto_close_timeout_secs, Some(300));
    }

    #[test]
    fn test_with_last_used_session() {
        let prefs = UserPreferences::new("prefs-1".to_string())
            .with_last_used_session(Some("session-123".to_string()));

        assert_eq!(prefs.last_used_session_id, Some("session-123".to_string()));
    }

    #[test]
    fn test_with_auto_select() {
        let prefs = UserPreferences::new("prefs-1".to_string()).with_auto_select(false);

        assert!(!prefs.auto_select_last_session);
    }

    #[test]
    fn test_auto_close_timeout() {
        let mut prefs = UserPreferences::new("prefs-1".to_string());
        assert_eq!(prefs.auto_close_timeout_secs, Some(300));

        prefs.update_auto_close_timeout(Some(60));
        assert_eq!(prefs.auto_close_timeout_secs, Some(60));

        prefs.update_auto_close_timeout(None);
        assert_eq!(prefs.auto_close_timeout_secs, None);
    }
}
