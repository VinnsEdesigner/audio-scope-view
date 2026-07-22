//! Settings domain types

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Trigger mode enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TriggerMode {
    Auto,
    Normal,
    Single,
}

impl TriggerMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Auto => "auto",
            Self::Normal => "normal",
            Self::Single => "single",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "auto" => Some(Self::Auto),
            "normal" => Some(Self::Normal),
            "single" => Some(Self::Single),
            _ => None,
        }
    }
}

impl Default for TriggerMode {
    fn default() -> Self {
        Self::Auto
    }
}

/// Trigger edge enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TriggerEdge {
    Rising,
    Falling,
    Both,
}

impl TriggerEdge {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Rising => "rising",
            Self::Falling => "falling",
            Self::Both => "both",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "rising" | "rise" => Some(Self::Rising),
            "falling" | "fall" => Some(Self::Falling),
            "both" | "alternate" => Some(Self::Both),
            _ => None,
        }
    }
}

impl Default for TriggerEdge {
    fn default() -> Self {
        Self::Rising
    }
}

/// Settings aggregate for scope display and capture configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    /// Unique identifier
    pub id: String,
    /// Associated scope ID
    pub scope_id: String,
    /// Time scale in ms/div
    pub time_scale: f64,
    /// Voltage scale in V/div
    pub voltage_scale: f64,
    /// Time offset in ms
    pub time_offset: f64,
    /// Voltage offset in V
    pub voltage_offset: f64,
    /// Trigger level in V
    pub trigger_level: f64,
    /// Trigger mode
    pub trigger_mode: TriggerMode,
    /// Trigger edge
    pub trigger_edge: TriggerEdge,
    /// Whether to show grid
    pub show_grid: bool,
    /// Whether to show measurements
    pub show_measurements: bool,
    /// Grid divisions X
    pub grid_divisions_x: u32,
    /// Grid divisions Y
    pub grid_divisions_y: u32,
    /// Audio input device
    pub input_device: Option<String>,
    /// Number of input channels
    pub input_channels: u32,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
}

impl Settings {
    /// Create new settings for a scope
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
            trigger_mode: TriggerMode::default(),
            trigger_edge: TriggerEdge::default(),
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

    /// Update time scale
    pub fn set_time_scale(&mut self, scale: f64) {
        self.time_scale = scale;
        self.touch();
    }

    /// Update voltage scale
    pub fn set_voltage_scale(&mut self, scale: f64) {
        self.voltage_scale = scale;
        self.touch();
    }

    /// Update trigger level
    pub fn set_trigger_level(&mut self, level: f64) {
        self.trigger_level = level;
        self.touch();
    }

    /// Update trigger mode
    pub fn set_trigger_mode(&mut self, mode: TriggerMode) {
        self.trigger_mode = mode;
        self.touch();
    }

    /// Update trigger edge
    pub fn set_trigger_edge(&mut self, edge: TriggerEdge) {
        self.trigger_edge = edge;
        self.touch();
    }

    /// Toggle grid visibility
    pub fn toggle_grid(&mut self) {
        self.show_grid = !self.show_grid;
        self.touch();
    }

    /// Toggle measurements visibility
    pub fn toggle_measurements(&mut self) {
        self.show_measurements = !self.show_measurements;
        self.touch();
    }

    /// Set input device
    pub fn set_input_device(&mut self, device: Option<String>) {
        self.input_device = device;
        self.touch();
    }

    fn touch(&mut self) {
        self.updated_at = Utc::now();
    }
}

/// Settings update parameters
#[derive(Debug, Clone)]
pub struct UpdateSettingsParams {
    pub time_scale: Option<f64>,
    pub voltage_scale: Option<f64>,
    pub time_offset: Option<f64>,
    pub voltage_offset: Option<f64>,
    pub trigger_level: Option<f64>,
    pub trigger_mode: Option<TriggerMode>,
    pub trigger_edge: Option<TriggerEdge>,
    pub show_grid: Option<bool>,
    pub show_measurements: Option<bool>,
    pub input_device: Option<String>,
}
