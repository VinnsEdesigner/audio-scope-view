
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::domain::valueobject_timerange::TimeRange;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardSummary {
    pub total_sessions: u32,
    pub active_sessions: u32,
    pub total_captures: u64,
    pub total_waveforms: u64,
    pub total_samples: u64,
    pub average_peak_amplitude: f32,
    pub average_rms_amplitude: f32,
    pub time_range: TimeRange,
    pub generated_at: DateTime<Utc>,
    pub recent_sessions: Vec<RecentScope>,
}

impl DashboardSummary {
    pub fn new(time_range: TimeRange) -> Self {
        Self {
            total_sessions: 0,
            active_sessions: 0,
            total_captures: 0,
            total_waveforms: 0,
            total_samples: 0,
            average_peak_amplitude: 0.0,
            average_rms_amplitude: 0.0,
            time_range,
            generated_at: Utc::now(),
            recent_sessions: Vec::new(),
        }
    }

    pub fn with_scope_stats(mut self, total: u32, active: u32) -> Self {
        self.total_sessions = total;
        self.active_sessions = active;
        self
    }

    pub fn with_capture_stats(mut self, captures: u64) -> Self {
        self.total_captures = captures;
        self
    }

    pub fn with_recent_sessions(mut self, scopes: Vec<RecentScope>) -> Self {
        self.recent_sessions = scopes;
        self
    }

    pub fn inactive_sessions(&self) -> u32 {
        self.total_sessions.saturating_sub(self.active_sessions)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentScope {
    pub id: String,
    pub name: String,
    pub last_activity: DateTime<Utc>,
    pub waveform_count: u32,
    pub is_active: bool,
}

impl RecentScope {
    pub fn new(id: String, name: String) -> Self {
        Self {
            id,
            name,
            last_activity: Utc::now(),
            waveform_count: 0,
            is_active: false,
        }
    }

    pub fn with_last_activity(mut self, timestamp: DateTime<Utc>) -> Self {
        self.last_activity = timestamp;
        self
    }

    pub fn with_waveform_count(mut self, count: u32) -> Self {
        self.waveform_count = count;
        self
    }

    pub fn with_active(mut self, active: bool) -> Self {
        self.is_active = active;
        self
    }
}

#[derive(Debug, Clone)]
pub struct DashboardFilter {
    pub time_range: TimeRange,
    pub scope_id: Option<String>,
    pub include_inactive: bool,
}

impl Default for DashboardFilter {
    fn default() -> Self {
        Self {
            time_range: TimeRange::Last24Hours,
            session_id: None,
            include_inactive: true,
        }
    }
}