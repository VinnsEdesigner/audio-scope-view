//! Time scale value object

#![allow(dead_code)]
use std::fmt;

use super::DomainError;

/// Time scale representing ms/division
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TimeScale {
    ms_per_div: f64,
}

impl TimeScale {
    /// Create from milliseconds per division
    pub fn from_ms_per_div(ms: f64) -> Result<Self, DomainError> {
        if ms <= 0.0 || ms.is_infinite() || ms.is_nan() {
            return Err(DomainError::validation(
                "Time scale must be positive and finite",
            ));
        }
        Ok(Self { ms_per_div: ms })
    }

    /// Create from microseconds per division
    pub fn from_us_per_div(us: f64) -> Result<Self, DomainError> {
        Self::from_ms_per_div(us / 1000.0)
    }

    /// Create from seconds per division
    pub fn from_s_per_div(s: f64) -> Result<Self, DomainError> {
        Self::from_ms_per_div(s * 1000.0)
    }

    /// Get as milliseconds per division
    pub fn as_ms_per_div(&self) -> f64 {
        self.ms_per_div
    }

    /// Get as microseconds per division
    pub fn as_us_per_div(&self) -> f64 {
        self.ms_per_div * 1000.0
    }

    /// Get as seconds per division
    pub fn as_s_per_div(&self) -> f64 {
        self.ms_per_div / 1000.0
    }

    /// Calculate total time window for given divisions
    pub fn total_time_ms(&self, divisions: u32) -> f64 {
        self.ms_per_div * divisions as f64
    }
}

impl fmt::Display for TimeScale {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.ms_per_div >= 1.0 {
            write!(f, "{:.1} ms/div", self.ms_per_div)
        } else if self.ms_per_div >= 0.001 {
            write!(f, "{:.1} μs/div", self.as_us_per_div())
        } else {
            write!(f, "{:.1} ns/div", self.as_us_per_div() * 1000.0)
        }
    }
}

impl Default for TimeScale {
    fn default() -> Self {
        // 1 ms/div default
        Self { ms_per_div: 1.0 }
    }
}
