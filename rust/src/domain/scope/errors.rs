//! Scope-specific domain errors

use crate::domain::_shared::domain_errors::DomainError;

/// Error types specific to scope operations
#[derive(Debug, Clone)]
pub enum ScopeError {
    ScopeNotFound(String),
    InvalidSampleRate(u32),
    InvalidBufferSize(u32),
    CannotActivateInactive,
    CannotDeactivateActive,
    ScopeLimitReached,
}

impl From<ScopeError> for DomainError {
    fn from(err: ScopeError) -> Self {
        match err {
            ScopeError::ScopeNotFound(id) => DomainError::not_found("Scope", &id),
            ScopeError::InvalidSampleRate(rate) => {
                DomainError::validation(format!("Invalid sample rate: {}", rate))
            }
            ScopeError::InvalidBufferSize(size) => {
                DomainError::validation(format!("Invalid buffer size: {}", size))
            }
            ScopeError::CannotActivateInactive => {
                DomainError::business_rule("Cannot activate inactive scope")
            }
            ScopeError::CannotDeactivateActive => {
                DomainError::business_rule("Cannot deactivate active scope")
            }
            ScopeError::ScopeLimitReached => {
                DomainError::business_rule("Maximum number of scopes reached")
            }
        }
    }
}
