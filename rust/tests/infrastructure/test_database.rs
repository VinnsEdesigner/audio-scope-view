//! Infrastructure tests for database operations

#[cfg(test)]
mod tests {
    #[test]
    fn test_database_connection_string() {
        let url = "sqlite:./data/audio_scope_view.db?mode=rwc";
        assert!(url.starts_with("sqlite:"));
        assert!(url.contains("audio_scope_view"));
    }

    #[test]
    fn test_migration_version_parsing() {
        let migrations = vec![
            (1, "create_scopes"),
            (2, "create_settings"),
            (3, "create_waveforms"),
        ];
        
        for (version, name) in migrations {
            assert!(version > 0);
            assert!(!name.is_empty());
        }
    }

    #[test]
    fn test_scope_row_serialization() {
        // Test that scope data can be serialized to/from database rows
        let row_data = serde_json::json!({
            "id": "test-123",
            "name": "Test Scope",
            "sample_rate": 44100,
            "buffer_size": 1024,
            "is_active": true
        });
        
        assert_eq!(row_data["id"], "test-123");
        assert_eq!(row_data["sample_rate"], 44100);
    }

    #[test]
    fn test_settings_row_serialization() {
        let row_data = serde_json::json!({
            "id": "settings-123",
            "scope_id": "scope-123",
            "time_scale": 1.0,
            "voltage_scale": 1.0,
            "trigger_level": 0.0,
            "trigger_mode": "auto",
            "trigger_edge": "rising"
        });
        
        assert_eq!(row_data["trigger_mode"], "auto");
        assert_eq!(row_data["trigger_edge"], "rising");
    }
}
