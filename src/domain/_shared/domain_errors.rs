
use thiserror::Error;

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
    pub fn not_found(entity_type: &'static str, id: &str) -> Self {
        Self::NotFound { entity_type, id: id.to_string() }
    }

    pub fn validation(msg: impl Into<String>) -> Self {
        Self::Validation(msg.into())
    }

    pub fn repository(msg: impl Into<String>) -> Self {
        Self::Repository(msg.into())
    }

    pub fn capture_error(msg: impl Into<String>) -> Self {
        Self::CaptureError(msg.into())
    }

    pub fn corruption(msg: impl Into<String>) -> Self {
        Self::Corruption(msg.into())
    }

    pub fn business_rule(msg: impl Into<String>) -> Self {
        Self::BusinessRule(msg.into())
    }

    pub fn conflict(msg: impl Into<String>) -> Self {
        Self::Conflict(msg.into())
    }
}

pub type DomainResult<T> = Result<T, DomainError>;
