#![allow(dead_code)]
//! GraphQL output DTOs - Response types to clients

use async_graphql::SimpleObject;

/// Pagination info for list responses
#[derive(Debug, SimpleObject)]
pub struct PageInfo {
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
    pub has_more: bool,
}

impl PageInfo {
    pub fn new(total: u32, limit: u32, offset: u32) -> Self {
        Self {
            total,
            limit,
            offset,
            has_more: (offset + limit) < total,
        }
    }
}

/// Scope output DTO
#[derive(Debug, SimpleObject)]
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

/// Paginated scopes result
#[derive(Debug, SimpleObject)]
pub struct ScopesResult {
    pub items: Vec<ScopeOutput>,
    pub page_info: PageInfo,
}

/// Settings output DTO
#[derive(Debug, SimpleObject)]
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
    pub created_at: String,
    pub updated_at: String,
}

/// Waveform data output DTO
#[derive(Debug, SimpleObject)]
pub struct WaveformOutput {
    pub id: String,
    pub scope_id: String,
    pub sample_count: u32,
    pub timestamp: String,
    pub duration_ms: f64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
}

/// Real-time waveform stream data
#[derive(Debug, SimpleObject)]
pub struct WaveformStreamOutput {
    pub scope_id: String,
    pub samples: Vec<f32>,
    pub timestamp: String,
    pub duration_ms: f64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
}

/// Recent scope info for dashboard
#[derive(Debug, SimpleObject)]
pub struct RecentScopeOutput {
    pub id: String,
    pub name: String,
    pub last_activity: String,
    pub waveform_count: u32,
    pub is_active: bool,
}

/// Dashboard summary output DTO
#[derive(Debug, SimpleObject)]
pub struct DashboardSummaryOutput {
    pub total_scopes: u32,
    pub active_scopes: u32,
    pub inactive_scopes: u32,
    pub total_waveforms: u64,
    pub total_samples: u64,
    pub average_peak_amplitude: f32,
    pub average_rms_amplitude: f32,
    pub time_range: String,
    pub generated_at: String,
    pub recent_scopes: Vec<RecentScopeOutput>,
}

/// Health check output
#[derive(Debug, SimpleObject)]
pub struct HealthOutput {
    pub status: String,
    pub version: String,
    pub uptime_seconds: u64,
    pub database_connected: bool,
}

/// Audio device info output
#[derive(Debug, SimpleObject)]
pub struct AudioDeviceOutput {
    pub id: String,
    pub name: String,
    pub channels: u32,
    pub sample_rate: u32,
    pub is_default: bool,
}

/// Capture state output
#[derive(Debug, SimpleObject)]
pub struct CaptureStateOutput {
    pub scope_id: String,
    pub is_capturing: bool,
    pub total_samples: u64,
    pub dropped_frames: u32,
    pub duration_seconds: Option<f64>,
}

/// Operation result for mutations
#[derive(Debug, SimpleObject)]
pub struct OperationResult {
    pub success: bool,
    pub message: Option<String>,
}

impl OperationResult {
    pub fn success_result() -> Self {
        Self {
            success: true,
            message: None,
        }
    }

    pub fn success_with_message(msg: impl Into<String>) -> Self {
        Self {
            success: true,
            message: Some(msg.into()),
        }
    }

    pub fn failure(msg: impl Into<String>) -> Self {
        Self {
            success: false,
            message: Some(msg.into()),
        }
    }
}
