//! Domain errors - Core error types for the domain layer

use thiserror::Error;

/// Domain-level errors
/// These represent business rule violations and infrastructure errors at the domain level
#[derive(Error, Debug)]
pub enum DomainError {
    #[error("Entity not found: {entity_type} with id {id}")]
    NotFound { entity_type: &'static str, id: String },

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Repository error: {0}")]
    Repository(String),

    #[error("Audio capture error: {0}")]
    CaptureError(String),

    #[error("Data corruption: {0}")]
    Corruption(String),

    #[error("Business rule violation: {0}")]
    BusinessRule(String),

    #[error("Concurrency conflict: {0}")]
    Conflict(String),
}

impl DomainError {
    /// Create a not found error
    pub fn not_found(entity_type: &'static str, id: &str) -> Self {
        Self::NotFound { entity_type, id: id.to_string() }
    }

    /// Create a validation error
    pub fn validation(msg: impl Into<String>) -> Self {
        Self::Validation(msg.into())
    }

    /// Create a repository error
    pub fn repository(msg: impl Into<String>) -> Self {
        Self::Repository(msg.into())
    }

    /// Create an audio capture error
    pub fn capture_error(msg: impl Into<String>) -> Self {
        Self::CaptureError(msg.into())
    }

    /// Create a corruption error
    pub fn corruption(msg: impl Into<String>) -> Self {
        Self::Corruption(msg.into())
    }

    /// Create a business rule error
    pub fn business_rule(msg: impl Into<String>) -> Self {
        Self::BusinessRule(msg.into())
    }

    /// Create a conflict error
    pub fn conflict(msg: impl Into<String>) -> Self {
        Self::Conflict(msg.into())
    }
}

/// Result type alias for domain operations
pub type DomainResult<T> = Result<T, DomainError>;
