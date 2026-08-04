#![allow(dead_code)]

use crate::domain::{Session, Settings};

#[derive(Debug, Clone)]
pub struct SessionOutput {
    pub id: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_seconds: Option<i64>,
}

impl From<Session> for SessionOutput {
    fn from(session: Session) -> Self {
        Self {
            id: session.id,
            started_at: session.started_at.to_rfc3339(),
            ended_at: session.ended_at.map(|dt| dt.to_rfc3339()),
            duration_seconds: session.duration_seconds,
        }
    }
}

#[derive(Debug, Clone)]
pub struct SettingsOutput {
    pub id: String,
    pub session_id: String,
    pub time_scale: f64,
    pub voltage_scale: f64,
    pub time_offset: f64,
    pub voltage_offset: f64,
    pub trigger_level: f64,
    pub trigger_mode: String,
    pub trigger_edge: String,
    pub show_grid: bool,
    pub show_measurements: bool,
    pub grid_divisions_x: u32,
    pub grid_divisions_y: u32,
    pub input_device: Option<String>,
    pub input_channels: u32,
}

impl From<Settings> for SettingsOutput {
    fn from(settings: Settings) -> Self {
        Self {
            id: settings.id,
            session_id: settings.session_id,
            time_scale: settings.time_scale,
            voltage_scale: settings.voltage_scale,
            time_offset: settings.time_offset,
            voltage_offset: settings.voltage_offset,
            trigger_level: settings.trigger_level,
            trigger_mode: settings.trigger_mode.as_str().to_string(),
            trigger_edge: settings.trigger_edge.as_str().to_string(),
            show_grid: settings.show_grid,
            show_measurements: settings.show_measurements,
            grid_divisions_x: settings.grid_divisions_x,
            grid_divisions_y: settings.grid_divisions_y,
            input_device: settings.input_device,
            input_channels: settings.input_channels,
        }
    }
}