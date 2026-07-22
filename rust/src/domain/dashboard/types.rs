//! Dashboard domain types

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::domain::valueobject_timerange::TimeRange;

/// Dashboard summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardSummary {
    /// Total number of scopes
    pub total_scopes: u32,
    /// Number of active scopes
    pub active_scopes: u32,
    /// Total waveform captures
    pub total_captures: u64,
    /// Total waveforms stored
    pub total_waveforms: u64,
    /// Total samples processed
    pub total_samples: u64,
    /// Average peak amplitude across all waveforms
    pub average_peak_amplitude: f32,
    /// Average RMS amplitude across all waveforms
    pub average_rms_amplitude: f32,
    /// Time range for this summary
    pub time_range: TimeRange,
    /// When this summary was generated
    pub generated_at: DateTime<Utc>,
    /// Recent scopes
    pub recent_scopes: Vec<RecentScope>,
}

impl DashboardSummary {
    /// Create a new dashboard summary
    pub fn new(time_range: TimeRange) -> Self {
        Self {
            total_scopes: 0,
            active_scopes: 0,
            total_captures: 0,
            total_waveforms: 0,
            total_samples: 0,
            average_peak_amplitude: 0.0,
            average_rms_amplitude: 0.0,
            time_range,
            generated_at: Utc::now(),
            recent_scopes: Vec::new(),
        }
    }

    /// Set scope statistics
    pub fn with_scope_stats(mut self, total: u32, active: u32) -> Self {
        self.total_scopes = total;
        self.active_scopes = active;
        self
    }

    /// Set capture statistics
    pub fn with_capture_stats(mut self, captures: u64) -> Self {
        self.total_captures = captures;
        self
    }

    /// Set recent scopes
    pub fn with_recent_scopes(mut self, scopes: Vec<RecentScope>) -> Self {
        self.recent_scopes = scopes;
        self
    }

    /// Calculate inactive scopes
    pub fn inactive_scopes(&self) -> u32 {
        self.total_scopes.saturating_sub(self.active_scopes)
    }
}

/// Recent scope info for dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentScope {
    /// Scope ID
    pub id: String,
    /// Scope name
    pub name: String,
    /// Last activity timestamp
    pub last_activity: DateTime<Utc>,
    /// Number of waveforms captured
    pub waveform_count: u32,
    /// Whether the scope is active
    pub is_active: bool,
}

impl RecentScope {
    /// Create a new recent scope
    pub fn new(id: String, name: String) -> Self {
        Self {
            id,
            name,
            last_activity: Utc::now(),
            waveform_count: 0,
            is_active: false,
        }
    }

    /// Set last activity
    pub fn with_last_activity(mut self, timestamp: DateTime<Utc>) -> Self {
        self.last_activity = timestamp;
        self
    }

    /// Set waveform count
    pub fn with_waveform_count(mut self, count: u32) -> Self {
        self.waveform_count = count;
        self
    }

    /// Set active state
    pub fn with_active(mut self, active: bool) -> Self {
        self.is_active = active;
        self
    }
}

/// Dashboard filter
#[derive(Debug, Clone)]
pub struct DashboardFilter {
    /// Time range to include
    pub time_range: TimeRange,
    /// Optional scope ID filter
    pub scope_id: Option<String>,
    /// Include inactive scopes
    pub include_inactive: bool,
}

impl Default for DashboardFilter {
    fn default() -> Self {
        Self {
            time_range: TimeRange::Last24Hours,
            scope_id: None,
            include_inactive: true,
        }
    }
}
