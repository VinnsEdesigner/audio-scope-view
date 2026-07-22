#![allow(dead_code)]
//! Settings entity - Display and audio settings for a scope

use chrono::{DateTime, Utc};

/// Trigger mode for the oscilloscope
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TriggerMode {
    Auto,
    Normal,
    Single,
}

impl TriggerMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            TriggerMode::Auto => "auto",
            TriggerMode::Normal => "normal",
            TriggerMode::Single => "single",
        }
    }

    #[allow(clippy::should_implement_trait)]
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "auto" => Some(TriggerMode::Auto),
            "normal" => Some(TriggerMode::Normal),
            "single" => Some(TriggerMode::Single),
            _ => None,
        }
    }
}

/// Trigger edge selection
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TriggerEdge {
    Rising,
    Falling,
    Both,
}

impl TriggerEdge {
    pub fn as_str(&self) -> &'static str {
        match self {
            TriggerEdge::Rising => "rising",
            TriggerEdge::Falling => "falling",
            TriggerEdge::Both => "both",
        }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "rising" => Some(TriggerEdge::Rising),
            "falling" => Some(TriggerEdge::Falling),
            "both" => Some(TriggerEdge::Both),
            _ => None,
        }
    }
}

/// Display and audio settings for a scope
#[derive(Debug, Clone, PartialEq)]
pub struct Settings {
    pub id: String,
    pub scope_id: String,

    // Display settings
    pub time_scale: f64,
    pub voltage_scale: f64,
    pub time_offset: f64,
    pub voltage_offset: f64,

    // Trigger settings
    pub trigger_level: f64,
    pub trigger_mode: TriggerMode,
    pub trigger_edge: TriggerEdge,

    // Display options
    pub show_grid: bool,
    pub show_measurements: bool,
    pub grid_divisions_x: u32,
    pub grid_divisions_y: u32,

    // Audio settings
    pub input_device: Option<String>,
    pub input_channels: u32,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Settings {
    /// Create new default settings for a scope
    pub fn new(id: String, scope_id: String) -> Self {
        let now = Utc::now();
        Self {
            id,
            scope_id,
            time_scale: 1.0,
            voltage_scale: 1.0,
            time_offset: 0.0,
            voltage_offset: 0.0,
            trigger_level: 0.0,
            trigger_mode: TriggerMode::Auto,
            trigger_edge: TriggerEdge::Rising,
            show_grid: true,
            show_measurements: true,
            grid_divisions_x: 10,
            grid_divisions_y: 8,
            input_device: None,
            input_channels: 1,
            created_at: now,
            updated_at: now,
        }
    }

    /// Update time scale (ms/div)
    pub fn with_time_scale(mut self, scale: f64) -> Self {
        self.time_scale = scale.clamp(0.001, 10000.0);
        self.updated_at = Utc::now();
        self
    }

    /// Update voltage scale (V/div)
    pub fn with_voltage_scale(mut self, scale: f64) -> Self {
        self.voltage_scale = scale.clamp(0.001, 10000.0);
        self.updated_at = Utc::now();
        self
    }

    /// Update trigger level
    pub fn with_trigger_level(mut self, level: f64) -> Self {
        self.trigger_level = level.clamp(-100.0, 100.0);
        self.updated_at = Utc::now();
        self
    }

    /// Update input device
    pub fn with_input_device(mut self, device: Option<String>) -> Self {
        self.input_device = device;
        self.updated_at = Utc::now();
        self
    }

    /// Calculate total time window in ms
    pub fn time_window_ms(&self, screen_divisions_x: u32) -> f64 {
        self.time_scale * screen_divisions_x as f64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_settings() {
        let settings = Settings::new("settings-1".to_string(), "scope-1".to_string());

        assert_eq!(settings.id, "settings-1");
        assert_eq!(settings.scope_id, "scope-1");
        assert_eq!(settings.time_scale, 1.0);
        assert_eq!(settings.voltage_scale, 1.0);
        assert!(matches!(settings.trigger_mode, TriggerMode::Auto));
    }

    #[test]
    fn test_trigger_modes() {
        assert_eq!(TriggerMode::Auto.as_str(), "auto");
        assert_eq!(TriggerMode::from_str("normal"), Some(TriggerMode::Normal));
        assert_eq!(TriggerEdge::Rising.as_str(), "rising");
        assert_eq!(TriggerEdge::from_str("falling"), Some(TriggerEdge::Falling));
    }
}
