//! Time range value object

#![allow(dead_code)]

use chrono::{DateTime, Duration, Utc};
use std::fmt;

use super::DomainError;

/// Time range for dashboard queries
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimeRange {
    /// Last hour
    LastHour,
    /// Last 24 hours
    Last24Hours,
    /// Last 7 days
    Last7Days,
    /// Last 30 days
    Last30Days,
    /// Custom range
    Custom {
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    },
}

impl TimeRange {
    /// Create a custom time range
    pub fn custom(start: DateTime<Utc>, end: DateTime<Utc>) -> Result<Self, DomainError> {
        if end <= start {
            return Err(DomainError::validation("End time must be after start time"));
        }
        Ok(Self::Custom { start, end })
    }

    /// Create from duration (ending now)
    pub fn from_duration(duration: Duration) -> Result<Self, DomainError> {
        if duration.num_seconds() <= 0 {
            return Err(DomainError::validation("Duration must be positive"));
        }
        let end = Utc::now();
        let start = end - duration;
        Ok(Self::Custom { start, end })
    }

    /// Get the start datetime
    pub fn start(&self) -> DateTime<Utc> {
        match self {
            Self::LastHour => Utc::now() - Duration::hours(1),
            Self::Last24Hours => Utc::now() - Duration::days(1),
            Self::Last7Days => Utc::now() - Duration::days(7),
            Self::Last30Days => Utc::now() - Duration::days(30),
            Self::Custom { start, .. } => *start,
        }
    }

    /// Get the end datetime
    pub fn end(&self) -> DateTime<Utc> {
        match self {
            Self::LastHour | Self::Last24Hours | Self::Last7Days | Self::Last30Days => Utc::now(),
            Self::Custom { end, .. } => *end,
        }
    }

    /// Get duration in seconds
    pub fn duration_secs(&self) -> i64 {
        (self.end() - self.start()).num_seconds()
    }

    /// Get duration in minutes
    pub fn duration_mins(&self) -> i64 {
        self.duration_secs() / 60
    }

    /// Get duration in hours
    pub fn duration_hours(&self) -> i64 {
        self.duration_secs() / 3600
    }

    /// Get duration in days (approximate)
    pub fn duration_days(&self) -> f64 {
        self.duration_secs() as f64 / 86400.0
    }
}

#[allow(clippy::derivable_impls)]
impl Default for TimeRange {
    fn default() -> Self {
        Self::Last24Hours
    }
}

impl fmt::Display for TimeRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TimeRange::LastHour => write!(f, "last_hour"),
            TimeRange::Last24Hours => write!(f, "last_24_hours"),
            TimeRange::Last7Days => write!(f, "last_7_days"),
            TimeRange::Last30Days => write!(f, "last_30_days"),
            TimeRange::Custom { .. } => write!(f, "custom"),
        }
    }
}
