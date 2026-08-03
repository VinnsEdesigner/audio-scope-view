
#![allow(dead_code)]
use std::fmt;

use super::DomainError;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Frequency {
    hz: f64,
}

impl Frequency {
    pub fn new(hz: f64) -> Result<Self, DomainError> {
        if hz <= 0.0 || hz.is_infinite() || hz.is_nan() {
            return Err(DomainError::validation(
                "Frequency must be positive and finite",
            ));
        }
        Ok(Self { hz })
    }

    pub fn from_hz(hz: f64) -> Self {
        Self { hz }
    }

    pub fn from_khz(khz: f64) -> Self {
        Self { hz: khz * 1000.0 }
    }

    pub fn as_hz(&self) -> f64 {
        self.hz
    }

    pub fn as_khz(&self) -> f64 {
        self.hz / 1000.0
    }

    pub fn as_mhz(&self) -> f64 {
        self.hz / 1_000_000.0
    }
}

impl fmt::Display for Frequency {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.hz >= 1_000_000.0 {
            write!(f, "{:.3} MHz", self.as_mhz())
        } else if self.hz >= 1000.0 {
            write!(f, "{:.3} kHz", self.as_khz())
        } else {
            write!(f, "{:.1} Hz", self.hz)
        }
    }
}

impl Default for Frequency {
    fn default() -> Self {
        Self { hz: 1000.0 }
    }
}
