//! Capture entity - Audio capture session state

#![allow(dead_code)]
use chrono::{DateTime, Utc};

/// Audio capture state
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CaptureState {
    Idle,
    Capturing,
    Paused,
    Error(String),
}

impl CaptureState {
    pub fn is_active(&self) -> bool {
        matches!(self, CaptureState::Capturing)
    }
}

/// Audio capture session
#[derive(Debug, Clone, PartialEq)]
pub struct Capture {
    pub id: String,
    pub scope_id: String,
    pub state: CaptureState,
    pub started_at: Option<DateTime<Utc>>,
    pub stopped_at: Option<DateTime<Utc>>,
    pub total_samples: u64,
    pub dropped_frames: u32,
}

impl Capture {
    /// Create a new capture session
    pub fn new(id: String, scope_id: String) -> Self {
        Self {
            id,
            scope_id,
            state: CaptureState::Idle,
            started_at: None,
            stopped_at: None,
            total_samples: 0,
            dropped_frames: 0,
        }
    }

    /// Start capturing
    pub fn start(&mut self) {
        self.state = CaptureState::Capturing;
        self.started_at = Some(Utc::now());
        self.total_samples = 0;
        self.dropped_frames = 0;
    }

    /// Pause capturing
    pub fn pause(&mut self) {
        if matches!(self.state, CaptureState::Capturing) {
            self.state = CaptureState::Paused;
        }
    }

    /// Resume capturing
    pub fn resume(&mut self) {
        if matches!(self.state, CaptureState::Paused) {
            self.state = CaptureState::Capturing;
        }
    }

    /// Stop capturing
    pub fn stop(&mut self) {
        self.state = CaptureState::Idle;
        self.stopped_at = Some(Utc::now());
    }

    /// Record an error
    pub fn set_error(&mut self, error: String) {
        self.state = CaptureState::Error(error);
    }

    /// Add captured samples
    pub fn add_samples(&mut self, count: u32) {
        if matches!(self.state, CaptureState::Capturing) {
            self.total_samples += count as u64;
        }
    }

    /// Record dropped frames
    pub fn add_dropped_frames(&mut self, count: u32) {
        self.dropped_frames += count;
    }

    /// Check if capture is active
    pub fn is_active(&self) -> bool {
        self.state.is_active()
    }

    /// Get capture duration in seconds
    pub fn duration_secs(&self) -> Option<f64> {
        match (self.started_at, self.stopped_at) {
            (Some(start), Some(stop)) => Some((stop - start).num_milliseconds() as f64 / 1000.0),
            (Some(start), None) if self.is_active() => {
                Some((Utc::now() - start).num_milliseconds() as f64 / 1000.0)
            }
            _ => None,
        }
    }
}
