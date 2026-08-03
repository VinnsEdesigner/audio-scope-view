#![allow(dead_code)]
//! User Preferences entity - Stores user-level settings

use chrono::{DateTime, Utc};

/// User Preferences entity
#[derive(Debug, Clone)]
pub struct UserPreferences {
    pub id: String,
    pub user_id: Option<String>,
    pub last_used_session_id: Option<String>,
    pub auto_select_last_session: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl UserPreferences {
    /// Create new user preferences with defaults
    pub fn new(id: String) -> Self {
        let now = Utc::now();
        Self {
            id,
            user_id: None,
            last_used_session_id: None,
            auto_select_last_session: true,
            created_at: now,
            updated_at: now,
        }
    }

    /// Set the last used session ID
    pub fn with_last_used_session(mut self, session_id: Option<String>) -> Self {
        self.last_used_session_id = session_id;
        self.updated_at = Utc::now();
        self
    }

    /// Set auto-select preference
    pub fn with_auto_select(mut self, auto_select: bool) -> Self {
        self.auto_select_last_session = auto_select;
        self.updated_at = Utc::now();
        self
    }

    /// Update the last used session ID
    pub fn update_last_used_session(&mut self, session_id: Option<String>) {
        self.last_used_session_id = session_id;
        self.updated_at = Utc::now();
    }

    /// Update auto-select preference
    pub fn update_auto_select(&mut self, auto_select: bool) {
        self.auto_select_last_session = auto_select;
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
    }

    #[test]
    fn test_with_last_used_session() {
        let prefs = UserPreferences::new("prefs-1".to_string())
            .with_last_used_session(Some("session-123".to_string()));
        
        assert_eq!(prefs.last_used_session_id, Some("session-123".to_string()));
    }

    #[test]
    fn test_with_auto_select() {
        let prefs = UserPreferences::new("prefs-1".to_string())
            .with_auto_select(false);
        
        assert!(!prefs.auto_select_last_session);
    }
}
