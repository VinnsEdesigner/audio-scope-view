//! Settings-specific domain errors

use crate::domain::_shared::domain_errors::DomainError;

/// Error types specific to settings operations
#[derive(Debug, Clone)]
pub enum SettingsError {
    SettingsNotFound(String),
    InvalidTimeScale(f64),
    InvalidVoltageScale(f64),
    InvalidTriggerLevel(f64),
    ScopeNotFound(String),
}

impl From<SettingsError> for DomainError {
    fn from(err: SettingsError) -> Self {
        match err {
            SettingsError::SettingsNotFound(id) => DomainError::not_found("Settings", &id),
            SettingsError::InvalidTimeScale(scale) => {
                DomainError::validation(format!("Invalid time scale: {}", scale))
            }
            SettingsError::InvalidVoltageScale(scale) => {
                DomainError::validation(format!("Invalid voltage scale: {}", scale))
            }
            SettingsError::InvalidTriggerLevel(level) => {
                DomainError::validation(format!("Invalid trigger level: {}", level))
            }
            SettingsError::ScopeNotFound(id) => DomainError::not_found("Scope", &id),
        }
    }
}
