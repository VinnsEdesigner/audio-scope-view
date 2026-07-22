//! Amplitude value object

#![allow(dead_code)]
use std::fmt;

use super::DomainError;

/// Amplitude value object supporting linear and dB representations
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Amplitude {
    linear: f32,
}

impl Amplitude {
    /// Create from linear value (0.0 to 1.0 for normalized)
    pub fn from_linear(linear: f32) -> Result<Self, DomainError> {
        if linear < 0.0 || linear.is_infinite() || linear.is_nan() {
            return Err(DomainError::validation(
                "Amplitude must be non-negative and finite",
            ));
        }
        Ok(Self { linear })
    }

    /// Create from decibels (dB) relative to full scale
    pub fn from_db(db: f32) -> Result<Self, DomainError> {
        if db.is_infinite() || db.is_nan() {
            return Err(DomainError::validation("dB value must be finite"));
        }
        // Convert dB to linear: linear = 10^(db/20)
        let linear = if db <= -96.0 {
            0.0 // Below digital silence
        } else {
            10.0_f32.powf(db / 20.0)
        };
        Ok(Self { linear })
    }

    /// Get value as linear (0.0 to 1.0)
    pub fn as_linear(&self) -> f32 {
        self.linear
    }

    /// Get value as dB relative to full scale
    pub fn as_db(&self) -> f32 {
        if self.linear == 0.0 {
            f32::NEG_INFINITY
        } else {
            20.0 * self.linear.log10()
        }
    }

    /// Get as voltage (assuming 1.0 = 1V peak)
    pub fn as_voltage_peak(&self) -> f32 {
        self.linear
    }

    /// Get as voltage peak-to-peak
    pub fn as_voltage_peak_to_peak(&self) -> f32 {
        self.linear * 2.0
    }

    /// Get as RMS voltage
    pub fn as_voltage_rms(&self) -> f32 {
        self.linear / std::f32::consts::SQRT_2
    }
}

impl fmt::Display for Amplitude {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:.2} dBFS ({:.4} linear)", self.as_db(), self.linear)
    }
}

impl Default for Amplitude {
    fn default() -> Self {
        Self { linear: 0.0 }
    }
}
