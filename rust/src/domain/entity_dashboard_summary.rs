#![allow(dead_code)]
use super::valueobject_timerange::TimeRange;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, PartialEq)]
pub struct DashboardSummary {
    pub time_range: TimeRange,
    pub generated_at: DateTime<Utc>,

    pub total_sessions: u32,
    pub active_sessions: u32,
    pub total_captures: u64,

    pub total_waveforms: u64,
    pub total_samples: u64,
    pub average_peak_amplitude: f32,
    pub average_rms_amplitude: f32,

    pub recent_sessions: Vec<RecentScope>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RecentScope {
    pub id: String,
    pub name: String,
    pub last_activity: DateTime<Utc>,
    pub waveform_count: u32,
}

impl DashboardSummary {
    pub fn new(time_range: TimeRange) -> Self {
        Self {
            time_range,
            generated_at: Utc::now(),
            total_sessions: 0,
            active_sessions: 0,
            total_captures: 0,
            total_waveforms: 0,
            total_samples: 0,
            average_peak_amplitude: 0.0,
            average_rms_amplitude: 0.0,
            recent_sessions: Vec::new(),
        }
    }

    pub fn with_scope_stats(mut self, total: u32, active: u32) -> Self {
        self.total_sessions = total;
        self.active_sessions = active;
        self
    }

    pub fn with_capture_stats(mut self, total: u64) -> Self {
        self.total_captures = total;
        self
    }

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

    pub fn with_recent_sessions(mut self, scopes: Vec<RecentScope>) -> Self {
        self.recent_sessions = scopes;
        self
    }

    pub fn has_data(&self) -> bool {
        self.total_sessions > 0 || self.total_waveforms > 0
    }
}

impl RecentScope {
    pub fn new(id: String, name: String) -> Self {
        Self {
            id,
            name,
            last_activity: Utc::now(),
            waveform_count: 0,
        }
    }

    pub fn with_last_activity(mut self, time: DateTime<Utc>) -> Self {
        self.last_activity = time;
        self
    }

    pub fn with_waveform_count(mut self, count: u32) -> Self {
        self.waveform_count = count;
        self
    }
}
