//! Domain validation utilities

use super::domain_errors::{DomainError, DomainResult};

/// Validation error with field information
#[derive(Debug, Clone)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

impl ValidationError {
    pub fn new(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            field: field.into(),
            message: message.into(),
        }
    }

    pub fn to_domain_error(&self) -> DomainError {
        DomainError::validation(format!("{}: {}", self.field, self.message))
    }
}

/// Validate a non-empty ID string
pub fn validate_id(id: &str) -> DomainResult<()> {
    if id.is_empty() {
        return Err(DomainError::validation("ID cannot be empty"));
    }
    if id.len() > 255 {
        return Err(DomainError::validation("ID exceeds maximum length of 255 characters"));
    }
    Ok(())
}

/// Validate a resource name
pub fn validate_name(name: &str) -> DomainResult<()> {
    if name.is_empty() {
        return Err(DomainError::validation("Name cannot be empty"));
    }
    if name.len() > 255 {
        return Err(DomainError::validation("Name exceeds maximum length of 255 characters"));
    }
    if name.trim().is_empty() {
        return Err(DomainError::validation("Name cannot be only whitespace"));
    }
    Ok(())
}

/// Validate sample rate is within acceptable range
pub fn validate_sample_rate(rate: u32) -> DomainResult<()> {
    if rate < 8000 {
        return Err(DomainError::validation("Sample rate must be at least 8000 Hz"));
    }
    if rate > 192000 {
        return Err(DomainError::validation("Sample rate cannot exceed 192000 Hz"));
    }
    Ok(())
}

/// Validate buffer size is within acceptable range
pub fn validate_buffer_size(size: u32) -> DomainResult<()> {
    if size < 64 {
        return Err(DomainError::validation("Buffer size must be at least 64 samples"));
    }
    if size > 16384 {
        return Err(DomainError::validation("Buffer size cannot exceed 16384 samples"));
    }
    if !size.is_power_of_two() {
        return Err(DomainError::validation("Buffer size must be a power of two"));
    }
    Ok(())
}

/// Validate time scale is within acceptable range
pub fn validate_time_scale(scale: f64) -> DomainResult<()> {
    if scale <= 0.0 {
        return Err(DomainError::validation("Time scale must be positive"));
    }
    if scale > 10000.0 {
        return Err(DomainError::validation("Time scale cannot exceed 10000 ms/div"));
    }
    Ok(())
}

/// Validate voltage scale is within acceptable range
pub fn validate_voltage_scale(scale: f64) -> DomainResult<()> {
    if scale <= 0.0 {
        return Err(DomainError::validation("Voltage scale must be positive"));
    }
    if scale > 10000.0 {
        return Err(DomainError::validation("Voltage scale cannot exceed 10000 V/div"));
    }
    Ok(())
}

/// Validate trigger level is within voltage range
pub fn validate_trigger_level(level: f64, voltage_range: f64) -> DomainResult<()> {
    if level.abs() > voltage_range {
        return Err(DomainError::validation(format!(
            "Trigger level {} exceeds voltage range ±{}",
            level, voltage_range
        )));
    }
    Ok(())
}

/// Validate a collection of samples
pub fn validate_samples(samples: &[f32]) -> DomainResult<()> {
    if samples.is_empty() {
        return Err(DomainError::validation("Samples collection cannot be empty"));
    }
    if samples.len() > 1_000_000 {
        return Err(DomainError::validation("Samples collection exceeds maximum size of 1,000,000"));
    }
    Ok(())
}
