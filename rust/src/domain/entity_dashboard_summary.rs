//! Dashboard Summary entity - Aggregated dashboard data

#![allow(dead_code)]
use super::valueobject_timerange::TimeRange;
use chrono::{DateTime, Utc};

/// Dashboard summary with aggregated data
#[derive(Debug, Clone, PartialEq)]
pub struct DashboardSummary {
    pub time_range: TimeRange,
    pub generated_at: DateTime<Utc>,

    // Scope statistics
    pub total_scopes: u32,
    pub active_scopes: u32,
    pub total_captures: u64,

    // Waveform statistics
    pub total_waveforms: u64,
    pub total_samples: u64,
    pub average_peak_amplitude: f32,
    pub average_rms_amplitude: f32,

    // Recent activity
    pub recent_scopes: Vec<RecentScope>,
}

/// Recent scope info for dashboard
#[derive(Debug, Clone, PartialEq)]
pub struct RecentScope {
    pub id: String,
    pub name: String,
    pub last_activity: DateTime<Utc>,
    pub waveform_count: u32,
}

impl DashboardSummary {
    /// Create a new dashboard summary
    pub fn new(time_range: TimeRange) -> Self {
        Self {
            time_range,
            generated_at: Utc::now(),
            total_scopes: 0,
            active_scopes: 0,
            total_captures: 0,
            total_waveforms: 0,
            total_samples: 0,
            average_peak_amplitude: 0.0,
            average_rms_amplitude: 0.0,
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
    pub fn with_capture_stats(mut self, total: u64) -> Self {
        self.total_captures = total;
        self
    }

    /// Set waveform statistics
    pub fn with_waveform_stats(
        mut self,
        count: u64,
        samples: u64,
        avg_peak: f32,
        avg_rms: f32,
    ) -> Self {
        self.total_waveforms = count;
        self.total_samples = samples;
        self.average_peak_amplitude = avg_peak;
        self.average_rms_amplitude = avg_rms;
        self
    }

    /// Set recent scopes
    pub fn with_recent_scopes(mut self, scopes: Vec<RecentScope>) -> Self {
        self.recent_scopes = scopes;
        self
    }

    /// Check if there's any data
    pub fn has_data(&self) -> bool {
        self.total_scopes > 0 || self.total_waveforms > 0
    }
}

impl RecentScope {
    /// Create a new recent scope
    pub fn new(id: String, name: String) -> Self {
        Self {
            id,
            name,
            last_activity: Utc::now(),
            waveform_count: 0,
        }
    }

    /// Set last activity timestamp
    pub fn with_last_activity(mut self, time: DateTime<Utc>) -> Self {
        self.last_activity = time;
        self
    }

    /// Set waveform count
    pub fn with_waveform_count(mut self, count: u32) -> Self {
        self.waveform_count = count;
        self
    }
}
