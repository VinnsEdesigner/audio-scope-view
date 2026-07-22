#![allow(dead_code)]
//! Scope mapper - Transform domain types to GraphQL types

use crate::domain::{DashboardSummary, RecentScope, Scope, Settings};

/// GraphQL output type for Scope
#[derive(Debug, Clone)]
pub struct ScopeOutput {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub sample_rate: u32,
    pub buffer_size: u32,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<Scope> for ScopeOutput {
    fn from(scope: Scope) -> Self {
        Self {
            id: scope.id,
            name: scope.name,
            description: scope.description,
            sample_rate: scope.sample_rate,
            buffer_size: scope.buffer_size,
            is_active: scope.is_active,
            created_at: scope.created_at.to_rfc3339(),
            updated_at: scope.updated_at.to_rfc3339(),
        }
    }
}

/// GraphQL output type for Settings
#[derive(Debug, Clone)]
pub struct SettingsOutput {
    pub id: String,
    pub scope_id: String,
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
            scope_id: settings.scope_id,
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

/// GraphQL output type for DashboardSummary
#[derive(Debug, Clone)]
pub struct DashboardSummaryOutput {
    pub total_scopes: u32,
    pub active_scopes: u32,
    pub total_captures: u64,
    pub total_waveforms: u64,
    pub total_samples: u64,
    pub average_peak_amplitude: f32,
    pub average_rms_amplitude: f32,
    pub time_range: String,
    pub generated_at: String,
    pub recent_scopes: Vec<RecentScopeOutput>,
}

/// GraphQL output type for RecentScope
#[derive(Debug, Clone)]
pub struct RecentScopeOutput {
    pub id: String,
    pub name: String,
    pub last_activity: String,
    pub waveform_count: u32,
}

impl From<RecentScope> for RecentScopeOutput {
    fn from(scope: RecentScope) -> Self {
        Self {
            id: scope.id,
            name: scope.name,
            last_activity: scope.last_activity.to_rfc3339(),
            waveform_count: scope.waveform_count,
        }
    }
}

impl From<DashboardSummary> for DashboardSummaryOutput {
    fn from(summary: DashboardSummary) -> Self {
        Self {
            total_scopes: summary.total_scopes,
            active_scopes: summary.active_scopes,
            total_captures: summary.total_captures,
            total_waveforms: summary.total_waveforms,
            total_samples: summary.total_samples,
            average_peak_amplitude: summary.average_peak_amplitude,
            average_rms_amplitude: summary.average_rms_amplitude,
            time_range: format!("{:?}", summary.time_range),
            generated_at: summary.generated_at.to_rfc3339(),
            recent_scopes: summary.recent_scopes.into_iter().map(Into::into).collect(),
        }
    }
}
